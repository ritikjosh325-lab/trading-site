import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchKlines, fetchTicker, type Candle, type Ticker } from '@/lib/binance';
import { fetchNews, summarizeSentiment, detectHighImpactEvents, type NewsItem, type SentimentSummary, type HighImpactEvent } from '@/lib/news';
import { computeSignal, type TradeSignal, type SignalMode } from '@/lib/signal';
import type { OrderBookImbalance, InstitutionalData } from '@/lib/orderbook';
import { emptyInstitutionalData } from '@/lib/orderbook';

interface MarketState {
  candles: Candle[];
  ticker: Ticker | null;
  news: NewsItem[];
  sentiment: SentimentSummary;
  highImpactEvents: HighImpactEvent[];
  orderBookImbalance: OrderBookImbalance | null;
  institutional: InstitutionalData;
  signal: TradeSignal | null;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
}

const initialState: MarketState = {
  candles: [],
  ticker: null,
  news: [],
  sentiment: summarizeSentiment([]),
  highImpactEvents: [],
  orderBookImbalance: null,
  institutional: emptyInstitutionalData(),
  signal: null,
  loading: true,
  error: null,
  lastUpdate: 0,
};

const SIGNAL_LOCK_MS = 5 * 60 * 1000;

function isActionable(signal: TradeSignal | null): boolean {
  return !!signal && (signal.action === 'BUY' || signal.action === 'SELL');
}

export function useMarketData(symbol: string, interval = '15m', mode: SignalMode = 'normal', orderBookImbalance: OrderBookImbalance | null = null, institutional: InstitutionalData = emptyInstitutionalData()) {
  const [state, setState] = useState<MarketState>(initialState);
  const [paused, setPaused] = useState(false);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const obRef = useRef(orderBookImbalance);
  obRef.current = orderBookImbalance;
  const instRef = useRef(institutional);
  instRef.current = institutional;

  const lockedSignalRef = useRef<TradeSignal | null>(null);
  const lockExpiryRef = useRef<number>(0);
  const lastCandleTimeRef = useRef<number>(0);

  const loadAll = useCallback(async (sym: string, showLoading: boolean, currentMode: SignalMode) => {
    if (showLoading) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [candles, ticker, news] = await Promise.all([
        fetchKlines(sym, interval, 100),
        fetchTicker(sym),
        fetchNews().catch(() => []),
      ]);
      const sentiment = summarizeSentiment(news);
      const highImpactEvents = detectHighImpactEvents(news);

      const lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : 0;
      const candleChanged = lastCandleTime !== lastCandleTimeRef.current;
      lastCandleTimeRef.current = lastCandleTime;

      const now = Date.now();
      const locked = lockedSignalRef.current && now < lockExpiryRef.current;

      let signal: TradeSignal;
      if (candleChanged || !locked) {
        signal = computeSignal(candles, sentiment, currentMode, highImpactEvents, obRef.current, instRef.current)!;
        if (isActionable(signal)) {
          lockedSignalRef.current = signal;
          lockExpiryRef.current = now + SIGNAL_LOCK_MS;
        } else if (!locked) {
          lockedSignalRef.current = null;
        }
      } else {
        signal = lockedSignalRef.current!;
      }

      setState({
        candles,
        ticker,
        news,
        sentiment,
        highImpactEvents,
        orderBookImbalance: obRef.current,
        institutional: instRef.current,
        signal,
        loading: false,
        error: null,
        lastUpdate: Date.now(),
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load market data',
      }));
    }
  }, [interval]);

  const refreshTicker = useCallback(async (sym: string, currentMode: SignalMode) => {
    try {
      const ticker = await fetchTicker(sym);
      setState((s) => {
        if (sym !== symbolRef.current) return s;
        const now = Date.now();
        const locked = lockedSignalRef.current && now < lockExpiryRef.current;
        if (locked) {
          return { ...s, ticker, lastUpdate: now };
        }
        const signal = computeSignal(s.candles, s.sentiment, currentMode, s.highImpactEvents, obRef.current, instRef.current);
        if (isActionable(signal)) {
          lockedSignalRef.current = signal;
          lockExpiryRef.current = now + SIGNAL_LOCK_MS;
        } else {
          lockedSignalRef.current = null;
        }
        return { ...s, ticker, signal, lastUpdate: now };
      });
    } catch {
      // ignore transient ticker errors
    }
  }, []);

  useEffect(() => {
    loadAll(symbol, true, mode);
    const tickerInterval = setInterval(() => {
      if (!paused) refreshTicker(symbol, modeRef.current);
    }, 5000);
    const fullInterval = setInterval(() => {
      if (!paused) loadAll(symbol, false, modeRef.current);
    }, 30000);
    return () => {
      clearInterval(tickerInterval);
      clearInterval(fullInterval);
    };
  }, [symbol, interval, paused, mode, loadAll, refreshTicker]);

  // Recompute signal immediately when mode or order book changes
  useEffect(() => {
    setState((s) => {
      if (s.candles.length < 30) return s;
      const now = Date.now();
      const locked = lockedSignalRef.current && now < lockExpiryRef.current;
      if (locked && mode === modeRef.current) {
        return { ...s, signal: lockedSignalRef.current };
      }
      const signal = computeSignal(s.candles, s.sentiment, mode, s.highImpactEvents, orderBookImbalance, institutional);
      if (isActionable(signal)) {
        lockedSignalRef.current = signal;
        lockExpiryRef.current = now + SIGNAL_LOCK_MS;
      } else {
        lockedSignalRef.current = null;
      }
      return { ...s, signal };
    });
  }, [mode, orderBookImbalance, institutional]);

  // Clear lock when symbol changes
  useEffect(() => {
    lockedSignalRef.current = null;
    lockExpiryRef.current = 0;
    lastCandleTimeRef.current = 0;
  }, [symbol]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  return { ...state, paused, togglePause };
}
