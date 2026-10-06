import { useCallback, useEffect, useRef, useState } from 'react';

export type SignalType = 'intraday' | 'scalp';
export type SignalDirection = 'LONG' | 'SHORT';
export type SignalStatus = 'in_progress' | 'tp1_hit' | 'tp2_hit' | 'sl_hit';

export interface SignalRecord {
  id: string;
  timestamp: number;
  symbol: string;
  type: SignalType;
  direction: SignalDirection;
  entry: number;
  entryLow: number;
  entryHigh: number;
  tp1: number;
  tp2: number;
  stopLoss: number;
  status: SignalStatus;
  pnlPct: number | null;
  resolvedAt: number | null;
}

export interface PerformanceStats {
  total: number;
  wins: number;
  losses: number;
  inProgress: number;
  winRate: number;
}

const STORAGE_KEY = 'cryptoflow_signal_history';
const MAX_RECORDS = 500;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function loadHistory(): SignalRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SignalRecord[];
  } catch {
    // ignore
  }
  return [];
}

function saveHistory(records: SignalRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // ignore quota or serialization errors
  }
}

function pruneOld(records: SignalRecord[]): SignalRecord[] {
  if (!Array.isArray(records)) return [];
  const cutoff = Date.now() - THIRTY_DAYS;
  return records.filter((r) => r && typeof r.timestamp === 'number' && r.timestamp > cutoff);
}

export function useSignalHistory() {
  const [records, setRecords] = useState<SignalRecord[]>(loadHistory);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  useEffect(() => {
    saveHistory(records);
  }, [records]);

  const logSignal = useCallback((params: {
    symbol: string;
    type: SignalType;
    direction: SignalDirection;
    entry: number;
    entryLow: number;
    entryHigh: number;
    tp1: number;
    tp2: number;
    stopLoss: number;
    candleCloseTime: number;
  }) => {
    const id = `${params.symbol}_${params.type}_${params.direction}_${params.candleCloseTime}`;
    setRecords((prev) => {
      if (prev.some((r) => r.id === id)) return prev;
      const record: SignalRecord = {
        id,
        timestamp: Date.now(),
        symbol: params.symbol,
        type: params.type,
        direction: params.direction,
        entry: params.entry,
        entryLow: params.entryLow,
        entryHigh: params.entryHigh,
        tp1: params.tp1,
        tp2: params.tp2,
        stopLoss: params.stopLoss,
        status: 'in_progress',
        pnlPct: null,
        resolvedAt: null,
      };
      return pruneOld([record, ...prev]);
    });
  }, []);

  const updateOutcomes = useCallback((livePrices: Record<string, number>) => {
    setRecords((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.status !== 'in_progress') return r;
        const price = livePrices[r.symbol];
        if (price == null) return r;

        const isLong = r.direction === 'LONG';

        if (isLong) {
          if (price >= r.tp2) {
            changed = true;
            return { ...r, status: 'tp2_hit' as SignalStatus, pnlPct: ((r.tp2 - r.entry) / r.entry) * 100, resolvedAt: Date.now() };
          }
          if (price >= r.tp1) {
            changed = true;
            return { ...r, status: 'tp1_hit' as SignalStatus, pnlPct: ((r.tp1 - r.entry) / r.entry) * 100, resolvedAt: Date.now() };
          }
          if (price <= r.stopLoss) {
            changed = true;
            return { ...r, status: 'sl_hit' as SignalStatus, pnlPct: ((r.stopLoss - r.entry) / r.entry) * 100, resolvedAt: Date.now() };
          }
        } else {
          if (price <= r.tp2) {
            changed = true;
            return { ...r, status: 'tp2_hit' as SignalStatus, pnlPct: ((r.entry - r.tp2) / r.entry) * 100, resolvedAt: Date.now() };
          }
          if (price <= r.tp1) {
            changed = true;
            return { ...r, status: 'tp1_hit' as SignalStatus, pnlPct: ((r.entry - r.tp1) / r.entry) * 100, resolvedAt: Date.now() };
          }
          if (price >= r.stopLoss) {
            changed = true;
            return { ...r, status: 'sl_hit' as SignalStatus, pnlPct: ((r.entry - r.stopLoss) / r.entry) * 100, resolvedAt: Date.now() };
          }
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, []);

  const stats: PerformanceStats = (() => {
    const recent = pruneOld(records);
    const wins = recent.filter((r) => r.status === 'tp1_hit' || r.status === 'tp2_hit').length;
    const losses = recent.filter((r) => r.status === 'sl_hit').length;
    const inProgress = recent.filter((r) => r.status === 'in_progress').length;
    const resolved = wins + losses;
    return {
      total: recent.length,
      wins,
      losses,
      inProgress,
      winRate: resolved > 0 ? (wins / resolved) * 100 : 0,
    };
  })();

  const recent24h = pruneOld(records);

  return { records: recent24h, stats, logSignal, updateOutcomes };
}
