export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  result.push(values[0]);
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    result.push(v);
    prev = v;
  }
  return result;
}

export function rsi(values: number[], period = 14): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  if (values.length <= period) return result;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export type Crossover = 'bullish' | 'bearish' | 'none';

export function detectCrossover(fast: number[], slow: number[], lookback = 3): Crossover {
  const n = fast.length;
  if (n < 3) return 'none';
  const start = Math.max(1, n - lookback);
  for (let i = n - 1; i >= start; i--) {
    if (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]) return 'bullish';
    if (fast[i] < slow[i] && fast[i - 1] >= slow[i - 1]) return 'bearish';
  }
  return 'none';
}

export function avgTrueRange(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function avgVolume(candles: { volume: number }[], period = 20): number {
  if (candles.length === 0) return 0;
  const slice = candles.slice(-period);
  return slice.reduce((s, c) => s + c.volume, 0) / slice.length;
}
