import { useEffect, useRef, useState } from 'react';
import type { OrderBookSnapshot, OrderBookImbalance } from '@/lib/orderbook';
import { computeImbalance } from '@/lib/orderbook';

const WS_BASE = 'wss://stream.binance.com:9443/ws';

interface RawDepthData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface RawTrade {
  p: string;
  q: string;
  T: number;
}

interface OrderFlowState {
  orderBook: OrderBookSnapshot | null;
  imbalance: OrderBookImbalance | null;
  lastPrice: number | null;
  connected: boolean;
}

const initialState: OrderFlowState = {
  orderBook: null,
  imbalance: null,
  lastPrice: null,
  connected: false,
};

export function useOrderFlow(symbol: string) {
  const [state, setState] = useState<OrderFlowState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

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
        const msg = JSON.parse(event.data) as RawDepthData | RawTrade;

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
          setState((s) => ({ ...s, lastPrice: parseFloat(msg.p) }));
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

  return state;
}
