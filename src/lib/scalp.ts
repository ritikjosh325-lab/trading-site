import type { Candle } from './binance';
import { ema, rsi, detectCrossover, avgTrueRange, avgVolume, swingHigh, swingLow, type Crossover } from './indicators';
import type { SentimentSummary, HighImpactEvent } from './news';
import type { OrderBookImbalance, LiquidityLevel, InstitutionalData } from './orderbook';
import { hasBullishSweep, hasBearishSweep, emptyInstitutionalData } from './orderbook';

export type ScalpAction = 'QUICK BUY' | 'QUICK SELL' | 'WAIT' | 'EVENT PAUSE' | 'CONFLICT';
export type ScalpTimeframe = '1m' | '3m' | '5m';
export type ScalpMode = 'normal' | 'leverage5x' | 'leverage10x';

export interface ScalpSignal {
  action: ScalpAction;
  confidence: number;
  entry: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  vwap: number;
  ema5: number;
  ema13: number;
  ema200: number;
  rsi7: number;
  crossover: Crossover;
  reasons: string[];
  timeframe: ScalpTimeframe;
  mode: ScalpMode;
  leverage: number;
  liquidationPrice: number;
  leverageRoiTp1: number;
  leverageRoiTp2: number;
  leverageRiskPct: number;
  rrTp1: number;
  rrTp2: number;
  eventPause: boolean;
  confluenceScore: number;
  checks: ConfluenceCheck[];
  volumeRatio: number;
  aboveEma200: boolean;
  mtfAligned: boolean;
  orderBookImbalance: OrderBookImbalance | null;
  liquiditySweeps: LiquidityLevel[];
  liquidityGrab: boolean;
  institutional: InstitutionalData;
  candleCloseTime: number;
  smartMoneySpike: boolean;
}

interface ConfluenceCheck {
  label: string;
  passed: boolean;
}

interface ScalpLeverageConfig {
  leverage: number;
  liqPct: number;
  label: string;
}

const SCALP_LEVERAGE_CONFIGS: Record<Exclude<ScalpMode, 'normal'>, ScalpLeverageConfig> = {
  leverage5x: { leverage: 5, liqPct: 0.19, label: '5x' },
  leverage10x: { leverage: 10, liqPct: 0.095, label: '10x' },
};

export function computeScalpSignal(
  candles: Candle[],
  timeframe: ScalpTimeframe,
  mode: ScalpMode = 'normal',
  sentiment: SentimentSummary | null = null,
  highImpactEvents: HighImpactEvent[] = [],
  mtf15mCandles: Candle[] | null = null,
  orderBookImbalance: OrderBookImbalance | null = null,
  liquiditySweeps: LiquidityLevel[] = [],
  institutional: InstitutionalData = emptyInstitutionalData()
): ScalpSignal | null {
  if (candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const ema5Arr = ema(closes, 5);
  const ema13Arr = ema(closes, 13);
  const ema200Arr = ema(closes, 200);
  const rsi7Arr = rsi(closes, 7);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const price = last.close;
  const ema5 = ema5Arr[ema5Arr.length - 1];
  const ema13 = ema13Arr[ema13Arr.length - 1];
  const ema200 = ema200Arr[ema200Arr.length - 1];
  const rsi7 = rsi7Arr[rsi7Arr.length - 1];
  const cross = detectCrossover(ema5Arr, ema13Arr, 3);
  const vwapVal = vwap(candles);
  const atr = avgTrueRange(candles, 14);
  const volAvg = avgVolume(candles, 20);
  const volRatio = volAvg > 0 ? last.volume / volAvg : 1;
  const aboveEma200 = price > ema200;

  const swHigh = swingHigh(candles, 20);
  const swLow = swingLow(candles, 20);

  // Recent range for liquidity grab + volume squeeze detection
  const recentCandles = candles.slice(-21, -1);
  const prevLow = recentCandles.length > 0 ? Math.min(...recentCandles.map((c) => c.low)) : swLow;
  const prevHigh = recentCandles.length > 0 ? Math.max(...recentCandles.map((c) => c.high)) : swHigh;

  // Multi-timeframe (computed but NOT enforced — scalping bypasses MTF)
  let mtfBullish = true;
  let mtfAligned = true;
  if (mtf15mCandles && mtf15mCandles.length >= 30) {
    const mtfCloses = mtf15mCandles.map((c) => c.close);
    const mtfEma9 = ema(mtfCloses, 9);
    const mtfEma21 = ema(mtfCloses, 21);
    const mtfEma200 = ema(mtfCloses, 200);
    const mtfPrice = mtfCloses[mtfCloses.length - 1];
    mtfBullish = mtfPrice > mtfEma200[mtfEma200.length - 1] && mtfEma9[mtfEma9.length - 1] > mtfEma21[mtfEma21.length - 1];
    const mtfBearish = mtfPrice < mtfEma200[mtfEma200.length - 1] && mtfEma9[mtfEma9.length - 1] < mtfEma21[mtfEma21.length - 1];
    mtfAligned = mtfBullish || mtfBearish;
  }

  const reasons: string[] = [];

  // --- High-impact event lock (still active for safety) ---
  if (highImpactEvents.length > 0) {
    reasons.push(`EVENT PAUSE: ${highImpactEvents.length} high-impact news detected in last 15 min — no trade`);
    return {
      action: 'EVENT PAUSE',
      confidence: 0,
      entry: price,
      entryLow: price,
      entryHigh: price,
      stopLoss: price,
      tp1: price,
      tp2: price,
      vwap: vwapVal,
      ema5, ema13, ema200, rsi7,
      crossover: cross,
      reasons,
      timeframe, mode,
      leverage: 1,
      liquidationPrice: price,
      leverageRoiTp1: 0, leverageRoiTp2: 0, leverageRiskPct: 0,
      rrTp1: 0, rrTp2: 0,
      eventPause: true,
      confluenceScore: 0,
      checks: [],
      volumeRatio: volRatio,
      aboveEma200,
      mtfAligned,
      orderBookImbalance,
      liquiditySweeps,
      liquidityGrab: false,
      institutional,
      candleCloseTime: last.time,
      smartMoneySpike: false,
    };
  }

  // ============================================================
  // SCALP ENGINE: Pre-Spike & Footprint Orderflow
  // Bypasses: 200 EMA trend, 15m MTF alignment, News sentiment, BOS
  // Trigger threshold: 60-65% (any 2-3 triggers match)
  // ============================================================

  let bullScore = 0;
  let bearScore = 0;
  let smartMoneySpike = false;

  // --- 1. LIQUIDITY GRAB (Pre-Spike) ---
  // Candle sweeps previous swing high/low by 0.2%-0.5% and closes back inside the range
  const sweepPctHigh = ((last.high - prevHigh) / prevHigh) * 100;
  const sweepPctLow = ((prevLow - last.low) / prevLow) * 100;
  const sweptHigh = last.high > prevHigh && last.close < prevHigh;
  const sweptLow = last.low < prevLow && last.close > prevLow;
  const liquidityGrabHigh = sweptHigh && sweepPctHigh >= 0.2 && sweepPctHigh <= 0.5;
  const liquidityGrabLow = sweptLow && sweepPctLow >= 0.2 && sweepPctLow <= 0.5;

  if (liquidityGrabHigh) {
    reasons.push(`LIQUIDITY GRAB: Swept swing high by ${sweepPctHigh.toFixed(2)}% and closed back inside — trapped longs, bearish reversal`);
    bearScore += 3;
    smartMoneySpike = true;
  }
  if (liquidityGrabLow) {
    reasons.push(`LIQUIDITY GRAB: Swept swing low by ${sweepPctLow.toFixed(2)}% and closed back inside — trapped shorts, bullish reversal`);
    bullScore += 3;
    smartMoneySpike = true;
  }

  // Also use orderbook-based liquidity sweep detection
  const bullSweep = hasBullishSweep(liquiditySweeps);
  const bearSweep = hasBearishSweep(liquiditySweeps);
  if (bullSweep) {
    reasons.push('Orderbook Sweep: Resistance swept — false breakout above recent highs, bearish');
    bearScore += 1.5;
    smartMoneySpike = true;
  }
  if (bearSweep) {
    reasons.push('Orderbook Sweep: Support swept — false breakdown below recent lows, bullish');
    bullScore += 1.5;
    smartMoneySpike = true;
  }
  const liquidityGrab = liquidityGrabHigh || liquidityGrabLow || bullSweep || bearSweep;

  // --- 2. VOLUME SQUEEZE (Pre-Spike) ---
  // Volume > 1.8x 20-period MA within tight range (<0.3%)
  const rangePct = ((last.high - last.low) / last.low) * 100;
  const volumeSqueeze = volRatio >= 1.8 && rangePct < 0.3;
  if (volumeSqueeze) {
    reasons.push(`VOLUME SQUEEZE: Vol ${volRatio.toFixed(1)}x avg in tight range (${rangePct.toFixed(2)}%) — energy building, breakout imminent`);
    bullScore += 0.5;
    bearScore += 0.5;
    smartMoneySpike = true;
  }

  // --- 3. FOOTPRINT: DELTA DIVERGENCE ---
  // Lower Low on price but rising Taker Buy Delta -> Instant Long
  // Higher High on price but falling Taker Buy Delta (CVD falling) -> Instant Short
  const madeLowerLow = last.low < prevLow;
  const madeHigherHigh = last.high > prevHigh;
  const cvdBullish = institutional.cvdRising && institutional.cvd > 0;
  const cvdBearish = institutional.cvdFalling && institutional.cvd < 0;

  if (madeLowerLow && cvdBullish) {
    reasons.push(`DELTA DIVERGENCE: Price made Lower Low but CVD rising (+${institutional.cvd.toFixed(1)}) — buyers absorbing, instant LONG`);
    bullScore += 3;
    smartMoneySpike = true;
  }
  if (madeHigherHigh && cvdBearish) {
    reasons.push(`DELTA DIVERGENCE: Price made Higher High but CVD falling (${institutional.cvd.toFixed(1)}) — sellers absorbing, instant SHORT`);
    bearScore += 3;
    smartMoneySpike = true;
  }

  // --- 4. TRAPPED TRADER DETECTION ---
  // Heavy volume absorbed in wick with reverse candle close
  // Trapped Shorts in bottom wick (bullish) / Trapped Longs in top wick (bearish)
  const bodyTop = Math.max(last.open, last.close);
  const bodyBottom = Math.min(last.open, last.close);
  const lowerWick = bodyBottom - last.low;
  const upperWick = last.high - bodyTop;
  const bodySize = bodyTop - bodyBottom;
  const isBullishClose = last.close > last.open;
  const isBearishClose = last.close < last.open;
  const heavyVol = volRatio >= 1.5;

  if (lowerWick > bodySize * 1.5 && isBullishClose && heavyVol) {
    reasons.push(`TRAPPED SHORTS: Bottom wick absorbed ${volRatio.toFixed(1)}x volume — shorts trapped below, bullish reversal`);
    bullScore += 2.5;
    smartMoneySpike = true;
  }
  if (upperWick > bodySize * 1.5 && isBearishClose && heavyVol) {
    reasons.push(`TRAPPED LONGS: Top wick absorbed ${volRatio.toFixed(1)}x volume — longs trapped above, bearish reversal`);
    bearScore += 2.5;
    smartMoneySpike = true;
  }

  // --- 5. EMA 5/13 crossover (momentum, not a blocker) ---
  if (cross === 'bullish') {
    reasons.push('5/13 EMA bullish crossover — momentum shift');
    bullScore += 1.5;
  } else if (cross === 'bearish') {
    reasons.push('5/13 EMA bearish crossover — momentum shift');
    bearScore += 1.5;
  } else if (ema5 > ema13) {
    bullScore += 0.5;
  } else {
    bearScore += 0.5;
  }

  // --- 6. VWAP (contextual, not a blocker) ---
  const vwapDist = ((price - vwapVal) / vwapVal) * 100;
  if (price > vwapVal && vwapDist < 0.3) {
    reasons.push(`VWAP bounce — price just above VWAP (+${vwapDist.toFixed(2)}%)`);
    bullScore += 1;
  } else if (price < vwapVal && vwapDist > -0.3) {
    reasons.push(`VWAP rejection — price just below VWAP (${vwapDist.toFixed(2)}%)`);
    bearScore += 1;
  }

  // --- 7. RSI(7) (contextual, not a blocker) ---
  if (rsi7 < 30) {
    reasons.push(`RSI(7) at ${rsi7.toFixed(0)} — oversold bounce`);
    bullScore += 1;
  } else if (rsi7 > 70) {
    reasons.push(`RSI(7) at ${rsi7.toFixed(0)} — overbought reversal`);
    bearScore += 1;
  }

  // --- 8. CVD (contextual, not a blocker) ---
  if (cvdBullish && !(madeLowerLow && cvdBullish)) {
    reasons.push(`CVD rising (+${institutional.cvd.toFixed(1)}) — buy absorption`);
    bullScore += 1;
  } else if (cvdBearish && !(madeHigherHigh && cvdBearish)) {
    reasons.push(`CVD falling (${institutional.cvd.toFixed(1)}) — sell absorption`);
    bearScore += 1;
  }

  // --- 9. Volume confirmation (contextual) ---
  const volumeOk = volRatio >= 1.3;
  if (volumeOk) {
    reasons.push(`Volume ${volRatio.toFixed(1)}x avg — participation confirmed`);
  } else {
    reasons.push(`Volume ${volRatio.toFixed(1)}x avg — below 1.3x, weak`);
  }

  // --- 10. News sentiment (informational only, NOT a blocker) ---
  if (sentiment) {
    if (sentiment.label === 'Bullish') {
      reasons.push(`News bullish (${sentiment.score.toFixed(0)}) — backdrop favorable (not enforced for scalps)`);
      bullScore += 0.5;
    } else if (sentiment.label === 'Bearish') {
      reasons.push(`News bearish (${sentiment.score.toFixed(0)}) — backdrop adverse (not enforced for scalps)`);
      bearScore += 0.5;
    }
  }

  // --- 11. OI (contextual, NOT a blocker) ---
  const oiRising = institutional.oiChangePct != null && institutional.oiChangePct > 0.1;
  if (oiRising) {
    reasons.push(`OI rising (+${institutional.oiChangePct!.toFixed(2)}%) — new positions entering`);
    bullScore += 0.5;
    bearScore += 0.5;
  }

  // --- DIRECTION & THRESHOLD (60-65% confidence = any 2-3 triggers match) ---
  let direction = 0;
  let action: ScalpAction = 'WAIT';
  let confidence = 50;

  const scoreDiff = Math.abs(bullScore - bearScore);
  const dominantSide = bullScore > bearScore ? 1 : bearScore > bullScore ? -1 : 0;

  // Require at least 2-3 strong triggers (score >= 3 total from spike triggers)
  if (dominantSide !== 0 && scoreDiff >= 2.5) {
    direction = dominantSide;
    confidence = Math.min(65, 50 + scoreDiff * 6);
    action = direction > 0 ? 'QUICK BUY' : 'QUICK SELL';

    if (smartMoneySpike) {
      confidence = Math.min(65, confidence + 5);
    }

    reasons.push(`Scalp threshold: ${scoreDiff.toFixed(1)} score differential, ${confidence.toFixed(0)}% confidence (60-65% scalp target)`);
  } else {
    if (dominantSide !== 0) {
      reasons.push(`Score differential ${scoreDiff.toFixed(1)} below scalp threshold (2.5) — waiting for 2-3 trigger confluence`);
    }
    direction = 0;
    action = 'WAIT';
    confidence = 50;
  }

  // --- SL: Rejection wick tip + tight buffer ---
  // LONG: SL below the wick low of the signal candle - small buffer
  // SHORT: SL above the wick high of the signal candle + small buffer
  const wickBuffer = Math.max(atr * 0.3, price * 0.001);
  const slLong = last.low - wickBuffer;
  const slShort = last.high + wickBuffer;
  const stopLoss = direction > 0 ? slLong : slShort;
  const slDist = direction > 0 ? price - stopLoss : stopLoss - price;

  // --- Targets: Quick 1:1.5 to 1:2 R:R ---
  const tp1Dist = slDist * 1.5;
  const tp2Dist = slDist * 2.0;
  const entry = price;
  const halfSpread = Math.max(atr * 0.1, price * 0.0005);
  const entryLow = entry - halfSpread;
  const entryHigh = entry + halfSpread;
  const tp1 = entry + direction * tp1Dist;
  const tp2 = entry + direction * tp2Dist;

  const slPct = slDist / price;
  const tp1Pct = tp1Dist / price;
  const tp2Pct = tp2Dist / price;
  const rrTp1 = tp1Pct / slPct;
  const rrTp2 = tp2Pct / slPct;

  if (direction !== 0) {
    reasons.push(`SL at ${fmtPriceVal(stopLoss)} — ${direction > 0 ? 'below rejection wick low' : 'above rejection wick high'} + tight buffer`);
    reasons.push(`Target: 1:${rrTp1.toFixed(1)} to 1:${rrTp2.toFixed(1)} R:R — quick scalp exit`);
    reasons.push(`Execution Range: ${fmtPriceVal(entryLow)} – ${fmtPriceVal(entryHigh)} (execute immediately)`);
  }

  const cfg = mode !== 'normal' ? SCALP_LEVERAGE_CONFIGS[mode] : null;
  const leverage = cfg ? cfg.leverage : 1;
  const liqPctVal = cfg ? cfg.liqPct : 0;
  const liquidationPrice = entry * (1 + direction * -liqPctVal);
  const leverageRoiTp1 = ((tp1 - entry) / entry) * 100 * leverage * direction;
  const leverageRoiTp2 = ((tp2 - entry) / entry) * 100 * leverage * direction;
  const leverageRiskPct = ((entry - stopLoss) / entry) * 100 * leverage * direction;

  if (cfg && direction !== 0) {
    reasons.push(
      `${cfg.label} leverage: SL at ${(slPct * 100).toFixed(2)}% limits risk to ${Math.abs(leverageRiskPct).toFixed(1)}% loss; liq ≈ ${(cfg.liqPct * 100).toFixed(1)}% adverse move`
    );
  }

  // --- Scalp confluence checks (lightweight — NOT 8/8 enforcement) ---
  const checks: ConfluenceCheck[] = [
    { label: 'Liquidity Grab', passed: liquidityGrab },
    { label: 'Volume Squeeze', passed: volumeSqueeze },
    { label: 'Delta Divergence', passed: (madeLowerLow && cvdBullish) || (madeHigherHigh && cvdBearish) },
    { label: 'Trapped Traders', passed: (lowerWick > bodySize * 1.5 && isBullishClose && heavyVol) || (upperWick > bodySize * 1.5 && isBearishClose && heavyVol) },
    { label: 'EMA 5/13 Cross', passed: cross !== 'none' },
    { label: 'CVD Absorption', passed: cvdBullish || cvdBearish },
    { label: 'Volume > 1.3x', passed: volumeOk },
  ];
  const confluenceScore = checks.filter((c) => c.passed).length;

  return {
    action,
    confidence,
    entry,
    entryLow,
    entryHigh,
    stopLoss,
    tp1,
    tp2,
    vwap: vwapVal,
    ema5, ema13, ema200, rsi7,
    crossover: cross,
    reasons,
    timeframe, mode,
    leverage,
    liquidationPrice,
    leverageRoiTp1, leverageRoiTp2, leverageRiskPct,
    rrTp1, rrTp2,
    eventPause: false,
    confluenceScore,
    checks,
    volumeRatio: volRatio,
    aboveEma200,
    mtfAligned,
    orderBookImbalance,
    liquiditySweeps,
    liquidityGrab,
    institutional,
    candleCloseTime: last.time,
    smartMoneySpike,
  };
}

function fmtPriceVal(p: number): string {
  return p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p.toFixed(6);
}

function vwap(candles: Candle[]): number {
  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumPV / cumVol : candles[candles.length - 1].close;
}
