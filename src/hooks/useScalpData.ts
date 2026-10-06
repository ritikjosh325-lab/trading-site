import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchKlines, fetchTicker, type Candle, type Ticker } from '@/lib/binance';
import { fetchNews, summarizeSentiment, detectHighImpactEvents, type SentimentSummary, type HighImpactEvent } from '@/lib/news';
import { computeScalpSignal, type ScalpSignal, type ScalpTimeframe, type ScalpMode } from '@/lib/scalp';
import type { OrderBookImbalance, LiquidityLevel, InstitutionalData } from '@/lib/orderbook';
import { detectLiquiditySweeps, emptyInstitutionalData } from '@/lib/orderbook';

interface ScalpState {
  candles: Candle[];
  ticker: Ticker | null;
  mtf15mCandles: Candle[];
  sentiment: SentimentSummary;
  highImpactEvents: HighImpactEvent[];
  orderBookImbalance: OrderBookImbalance | null;
  liquiditySweeps: LiquidityLevel[];
  institutional: InstitutionalData;
  signal: ScalpSignal | null;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
}

const emptySentiment = summarizeSentiment([]);

const initialState: ScalpState = {
  candles: [],
  ticker: null,
  mtf15mCandles: [],
  sentiment: emptySentiment,
  highImpactEvents: [],
  orderBookImbalance: null,
  liquiditySweeps: [],
  institutional: emptyInstitutionalData(),
  signal: null,
  loading: true,
  error: null,
  lastUpdate: 0,
};

const SIGNAL_LOCK_MS = 5 * 60 * 1000;

function isActionable(signal: ScalpSignal | null): boolean {
  return !!signal && (signal.action === 'QUICK BUY' || signal.action === 'QUICK SELL');
}

export function useScalpData(symbol: string, timeframe: ScalpTimeframe = '1m', mode: ScalpMode = 'normal', orderBookImbalance: OrderBookImbalance | null = null, institutional: InstitutionalData = emptyInstitutionalData()) {
  const [state, setState] = useState<ScalpState>(initialState);
  const [paused, setPaused] = useState(false);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const tfRef = useRef(timeframe);
  tfRef.current = timeframe;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const obRef = useRef(orderBookImbalance);
  obRef.current = orderBookImbalance;
  const instRef = useRef(institutional);
  instRef.current = institutional;

  const lockedSignalRef = useRef<ScalpSignal | null>(null);
  const lockExpiryRef = useRef<number>(0);
  const lastCandleTimeRef = useRef<number>(0);

  const loadAll = useCallback(async (sym: string, showLoading: boolean, tf: ScalpTimeframe, currentMode: ScalpMode) => {
    if (showLoading) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [candles, ticker, mtf15mCandles, news] = await Promise.all([
        fetchKlines(sym, tf, 100),
        fetchTicker(sym),
        fetchKlines(sym, '15m', 100).catch(() => []),
        fetchNews().catch(() => []),
      ]);
      const sentiment = summarizeSentiment(news);
      const highImpactEvents = detectHighImpactEvents(news);
      const sweeps = detectLiquiditySweeps(candles);

      const lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : 0;
      const candleChanged = lastCandleTime !== lastCandleTimeRef.current;
      lastCandleTimeRef.current = lastCandleTime;

      const now = Date.now();
      const locked = lockedSignalRef.current && now < lockExpiryRef.current;

      let signal: ScalpSignal;
      if (candleChanged || !locked) {
        signal = computeScalpSignal(candles, tf, currentMode, sentiment, highImpactEvents, mtf15mCandles, obRef.current, sweeps, instRef.current)!;
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
        mtf15mCandles,
        sentiment,
        highImpactEvents,
        orderBookImbalance: obRef.current,
        liquiditySweeps: sweeps,
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
        error: e instanceof Error ? e.message : 'Failed to load scalp data',
      }));
    }
  }, []);

  const refreshTicker = useCallback(async (sym: string, tf: ScalpTimeframe, currentMode: ScalpMode) => {
    try {
      const ticker = await fetchTicker(sym);
      setState((s) => {
        if (sym !== symbolRef.current) return s;
        const now = Date.now();
        const locked = lockedSignalRef.current && now < lockExpiryRef.current;
        if (locked) {
          return { ...s, ticker, lastUpdate: now };
        }
        const sweeps = detectLiquiditySweeps(s.candles);
        const signal = computeScalpSignal(s.candles, tf, currentMode, s.sentiment, s.highImpactEvents, s.mtf15mCandles, obRef.current, sweeps, instRef.current);
        if (isActionable(signal)) {
          lockedSignalRef.current = signal;
          lockExpiryRef.current = now + SIGNAL_LOCK_MS;
        } else {
          lockedSignalRef.current = null;
        }
        return { ...s, ticker, liquiditySweeps: sweeps, signal, lastUpdate: now };
      });
    } catch {
      // ignore transient ticker errors
    }
  }, []);

  useEffect(() => {
    loadAll(symbol, true, timeframe, mode);
    const tickerInterval = setInterval(() => {
      if (!paused) refreshTicker(symbol, tfRef.current, modeRef.current);
    }, 3000);
    const fullInterval = setInterval(() => {
      if (!paused) loadAll(symbol, false, tfRef.current, modeRef.current);
    }, 10000);
    return () => {
      clearInterval(tickerInterval);
      clearInterval(fullInterval);
    };
  }, [symbol, timeframe, paused, mode, loadAll, refreshTicker]);

  // Recompute signal immediately when mode, timeframe, or order book changes
  // (but respect the lock)
  useEffect(() => {
    setState((s) => {
      if (s.candles.length < 30) return s;
      const now = Date.now();
      const locked = lockedSignalRef.current && now < lockExpiryRef.current;
      if (locked && timeframe === tfRef.current && mode === modeRef.current) {
        return { ...s, signal: lockedSignalRef.current };
      }
      const sweeps = detectLiquiditySweeps(s.candles);
      const signal = computeScalpSignal(s.candles, timeframe, mode, s.sentiment, s.highImpactEvents, s.mtf15mCandles, orderBookImbalance, sweeps, institutional);
      if (isActionable(signal)) {
        lockedSignalRef.current = signal;
        lockExpiryRef.current = now + SIGNAL_LOCK_MS;
      } else {
        lockedSignalRef.current = null;
      }
      return { ...s, liquiditySweeps: sweeps, signal };
    });
  }, [mode, timeframe, orderBookImbalance, institutional]);

  // Clear lock when symbol changes
  useEffect(() => {
    lockedSignalRef.current = null;
    lockExpiryRef.current = 0;
    lastCandleTimeRef.current = 0;
  }, [symbol]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  return { ...state, paused, togglePause };
}
