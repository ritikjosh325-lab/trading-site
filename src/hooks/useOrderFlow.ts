import { useEffect, useRef, useState } from 'react';
import type { OrderBookSnapshot, OrderBookImbalance, InstitutionalData } from '@/lib/orderbook';
import { computeImbalance, emptyInstitutionalData } from '@/lib/orderbook';
import { fetchOpenInterest } from '@/lib/binance';

const WS_BASE = 'wss://stream.binance.com:9443/ws';
const OI_POLL_MS = 30_000;
const CVD_WINDOW_MS = 5 * 60 * 1000;

interface RawDepthData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface RawTrade {
  p: string;
  q: string;
  T: number;
  m: boolean;
}

interface OrderFlowState {
  orderBook: OrderBookSnapshot | null;
  imbalance: OrderBookImbalance | null;
  lastPrice: number | null;
  connected: boolean;
  institutional: InstitutionalData;
}

const initialState: OrderFlowState = {
  orderBook: null,
  imbalance: null,
  lastPrice: null,
  connected: false,
  institutional: emptyInstitutionalData(),
};

interface TradeTick {
  time: number;
  delta: number;
}

export function useOrderFlow(symbol: string) {
  const [state, setState] = useState<OrderFlowState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const cvdRef = useRef(0);
  const prevCvdRef = useRef(0);
  const tradeBufferRef = useRef<TradeTick[]>([]);
  const prevOiRef = useRef<number | null>(null);

  useEffect(() => {
    const streamName = symbol.toLowerCase();
    const url = `${WS_BASE}/${streamName}@depth10@100ms/${streamName}@trade`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(url);

      ws.onopen = () => {
        setState((s) => ({ ...s, connected: true }));
      };

      ws.onmessage = (event) => {
        let msg: RawDepthData | RawTrade;
        try {
          msg = JSON.parse(event.data) as RawDepthData | RawTrade;
        } catch {
          return;
        }

        try {
          if ('bids' in msg && 'asks' in msg) {
            const book: OrderBookSnapshot = {
              bids: msg.bids.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
              asks: msg.asks.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
              lastUpdateId: msg.lastUpdateId,
            };
            const imbalance = computeImbalance(book);
            setState((s) => ({
              ...s,
              orderBook: book,
              imbalance,
            }));
          } else if ('p' in msg) {
            const price = parseFloat(msg.p);
            const qty = parseFloat(msg.q);
            const isBuyerMaker = msg.m;
            const delta = isBuyerMaker ? -qty : qty;
            const now = Date.now();

            cvdRef.current += delta;
            tradeBufferRef.current.push({ time: now, delta });
            const cutoff = now - CVD_WINDOW_MS;
            while (tradeBufferRef.current.length > 0 && tradeBufferRef.current[0].time < cutoff) {
              cvdRef.current -= tradeBufferRef.current[0].delta;
              tradeBufferRef.current.shift();
            }

            const cvdRising = cvdRef.current > prevCvdRef.current;
            const cvdFalling = cvdRef.current < prevCvdRef.current;
            prevCvdRef.current = cvdRef.current;

            setState((s) => ({
              ...s,
              lastPrice: price,
              institutional: {
                ...s.institutional,
                cvd: cvdRef.current,
                cvdRising,
                cvdFalling,
              },
            }));
          }
        } catch {
          // ignore malformed tick data
        }
      };

      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false }));
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [symbol]);

  // Reset CVD/OI state on symbol change
  useEffect(() => {
    cvdRef.current = 0;
    prevCvdRef.current = 0;
    tradeBufferRef.current = [];
    prevOiRef.current = null;
    setState((s) => ({ ...s, institutional: emptyInstitutionalData() }));
  }, [symbol]);

  // Poll Binance Futures Open Interest
  useEffect(() => {
    let cancelled = false;

    async function pollOI() {
      try {
        const oi = await fetchOpenInterest(symbol);
        if (cancelled) return;
        let oiChangePct: number | null = null;
        if (prevOiRef.current != null && prevOiRef.current > 0) {
          oiChangePct = ((oi - prevOiRef.current) / prevOiRef.current) * 100;
        }
        prevOiRef.current = oi;

        setState((s) => ({
          ...s,
          institutional: {
            ...s.institutional,
            openInterest: oi,
            oiChangePct,
          },
        }));
      } catch {
        // OI endpoint may be rate-limited or unavailable
      }
    }

    pollOI();
    const interval = setInterval(pollOI, OI_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  return state;
}
