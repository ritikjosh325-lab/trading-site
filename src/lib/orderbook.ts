export interface OrderBookLevel {
  price: number;
  qty: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
}

export interface OrderBookImbalance {
  bidVolume: number;
  askVolume: number;
  bidPct: number;
  askPct: number;
  ratio: number;
  askHeavy: boolean;
  bidHeavy: boolean;
  blockLong: boolean;
  blockShort: boolean;
  label: string;
}

export function computeImbalance(book: OrderBookSnapshot | null): OrderBookImbalance | null {
  if (!book || book.bids.length === 0 || book.asks.length === 0) return null;

  const bidVolume = book.bids.reduce((s, l) => s + l.qty, 0);
  const askVolume = book.asks.reduce((s, l) => s + l.qty, 0);
  const total = bidVolume + askVolume;
  if (total === 0) return null;

  const bidPct = (bidVolume / total) * 100;
  const askPct = (askVolume / total) * 100;

  const askHeavy = askPct > 65;
  const bidHeavy = bidPct > 65;

  return {
    bidVolume,
    askVolume,
    bidPct,
    askPct,
    ratio: bidVolume / askVolume,
    askHeavy,
    bidHeavy,
    blockLong: askHeavy,
    blockShort: bidHeavy,
    label: askHeavy ? 'Ask Wall' : bidHeavy ? 'Bid Wall' : 'Balanced',
  };
}

export interface LiquidityLevel {
  type: 'resistance' | 'support';
  price: number;
  swept: boolean;
  sweepTime: number;
}

export function detectLiquiditySweeps(
  candles: { time: number; high: number; low: number; close: number }[],
  lookback = 20
): LiquidityLevel[] {
  if (candles.length < lookback + 2) return [];

  const recent = candles.slice(-lookback - 2, -2);
  if (recent.length < 5) return [];

  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const levels: LiquidityLevel[] = [];

  // Resistance sweep: prev candle broke above maxHigh but last candle closed back below (false breakout)
  if (prev.high > maxHigh && last.close < maxHigh) {
    levels.push({
      type: 'resistance',
      price: maxHigh,
      swept: true,
      sweepTime: prev.time,
    });
  }

  // Support sweep: prev candle broke below minLow but last candle closed back above (false breakdown)
  if (prev.low < minLow && last.close > minLow) {
    levels.push({
      type: 'support',
      price: minLow,
      swept: true,
      sweepTime: prev.time,
    });
  }

  return levels;
}

export function hasBullishSweep(levels: LiquidityLevel[]): boolean {
  return levels.some((l) => l.type === 'resistance' && l.swept);
}

export function hasBearishSweep(levels: LiquidityLevel[]): boolean {
  return levels.some((l) => l.type === 'support' && l.swept);
}
