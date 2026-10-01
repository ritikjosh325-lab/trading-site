import { useEffect, useRef, useState } from 'react';
import type { ScalpSignal } from '@/lib/scalp';
import type { TradeSignal } from '@/lib/signal';

type AnySignal = ScalpSignal | TradeSignal | null;

function isActionableSignal(prev: AnySignal, next: AnySignal): boolean {
  if (!next) return false;
  const action = next.action;
  if (action !== 'QUICK BUY' && action !== 'QUICK SELL' && action !== 'BUY' && action !== 'SELL') return false;
  if (!prev) return true;
  return prev.action !== action;
}

function playBeep(isBuy: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = isBuy ? 880 : 440;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available
  }
}

export function useSignalAlert(signal: AnySignal) {
  const prevRef = useRef<AnySignal>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = signal;

    if (isActionableSignal(prev, signal) && signal) {
      const isBuy = signal.action === 'QUICK BUY' || signal.action === 'BUY';
      playBeep(isBuy);
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [signal]);

  return pulse;
}
