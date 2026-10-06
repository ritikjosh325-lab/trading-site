import type { Candle } from './binance';
import { ema, rsi, detectCrossover, avgTrueRange, avgVolume, type Crossover } from './indicators';
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

  // --- Multi-timeframe alignment: 15m trend ---
  let mtfBullish = true;
  let mtfAligned = true;
  if (mtf15mCandles && mtf15mCandles.length >= 30) {
    const mtfCloses = mtf15mCandles.map((c) => c.close);
    const mtfEma9 = ema(mtfCloses, 9);
    const mtfEma21 = ema(mtfCloses, 21);
    const mtfEma200 = ema(mtfCloses, 200);
    const mtfPrice = mtfCloses[mtfCloses.length - 1];
    const mtfEma9Last = mtfEma9[mtfEma9.length - 1];
    const mtfEma21Last = mtfEma21[mtfEma21.length - 1];
    const mtfEma200Last = mtfEma200[mtfEma200.length - 1];
    mtfBullish = mtfPrice > mtfEma200Last && mtfEma9Last > mtfEma21Last;
  const mtfBearish = mtfPrice < mtfEma200Last && mtfEma9Last < mtfEma21Last;
    mtfAligned = mtfBullish || mtfBearish;
  }

  const reasons: string[] = [];

  // --- High-impact event lock ---
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
      ema5,
      ema13,
      ema200,
      rsi7,
      crossover: cross,
      reasons,
      timeframe,
      mode,
      leverage: 1,
      liquidationPrice: price,
      leverageRoiTp1: 0,
      leverageRoiTp2: 0,
      leverageRiskPct: 0,
      rrTp1: 0,
      rrTp2: 0,
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
    };
  }

  let bullScore = 0;
  let bearScore = 0;

  // --- 200 EMA trend filter ---
  if (aboveEma200) {
    reasons.push('Price above 200 EMA — macro uptrend, longs preferred');
    bullScore += 2;
  } else {
    reasons.push('Price below 200 EMA — macro downtrend, shorts preferred');
    bearScore += 2;
  }

  // --- 5/13 EMA crossover ---
  if (cross === 'bullish') {
    reasons.push('5 EMA crossed above 13 EMA — fast bullish momentum shift');
    bullScore += 2.5;
  } else if (cross === 'bearish') {
    reasons.push('5 EMA crossed below 13 EMA — fast bearish momentum shift');
    bearScore += 2.5;
  } else if (ema5 > ema13) {
    reasons.push('5 EMA above 13 EMA — short-term uptrend');
    bullScore += 1;
  } else {
    reasons.push('5 EMA below 13 EMA — short-term downtrend');
    bearScore += 1;
  }

  // --- VWAP ---
  const vwapDist = ((price - vwapVal) / vwapVal) * 100;
  if (price > vwapVal) {
    if (vwapDist < 0.3) {
      reasons.push(`VWAP bounce — price holding just above VWAP (+${vwapDist.toFixed(2)}%)`);
      bullScore += 2;
    } else {
      reasons.push(`Price above VWAP (+${vwapDist.toFixed(2)}%) — bullish bias`);
      bullScore += 1;
    }
  } else if (price < vwapVal) {
    if (vwapDist > -0.3) {
      reasons.push(`VWAP rejection — price pressing just below VWAP (${vwapDist.toFixed(2)}%)`);
      bearScore += 2;
    } else {
      reasons.push(`Price below VWAP (${vwapDist.toFixed(2)}%) — bearish bias`);
      bearScore += 1;
    }
  } else {
    reasons.push('Price at VWAP — equilibrium, watch for breakout direction');
  }

  // --- RSI(7) ---
  if (rsi7 < 30) {
    reasons.push(`Fast RSI(7) at ${rsi7.toFixed(0)} — oversold bounce setup`);
    bullScore += 1.5;
  } else if (rsi7 > 70) {
    reasons.push(`Fast RSI(7) at ${rsi7.toFixed(0)} — overbought, reversal risk`);
    bearScore += 1.5;
  } else if (rsi7 > 55) {
    reasons.push(`Fast RSI(7) at ${rsi7.toFixed(0)} — bullish momentum`);
    bullScore += 0.5;
  } else if (rsi7 < 45) {
    reasons.push(`Fast RSI(7) at ${rsi7.toFixed(0)} — bearish momentum`);
    bearScore += 0.5;
  } else {
    reasons.push(`Fast RSI(7) at ${rsi7.toFixed(0)} — neutral`);
  }

  // --- Volume confirmation ---
  const volumeOk = volRatio >= 1.3;
  if (volumeOk) {
    reasons.push(`Volume ${volRatio.toFixed(1)}x avg — strong participation confirms entry`);
  } else {
    reasons.push(`Volume ${volRatio.toFixed(1)}x avg — below 1.3x threshold, weak confirmation`);
  }

  // --- MTF alignment ---
  if (mtf15mCandles && mtf15mCandles.length >= 30) {
    if (mtfBullish) {
      reasons.push('15m trend bullish — scalp longs aligned with higher timeframe');
      bullScore += 1.5;
    } else {
      reasons.push('15m trend bearish — scalp shorts aligned with higher timeframe');
      bearScore += 1.5;
    }
  }

  // --- Order book imbalance filter ---
  let orderBookOk = true;
  if (orderBookImbalance) {
    if (orderBookImbalance.blockLong) {
      reasons.push(`Order Book: Ask wall ${orderBookImbalance.askPct.toFixed(0)}% — institutional resistance blocks LONG`);
    } else if (orderBookImbalance.blockShort) {
      reasons.push(`Order Book: Bid wall ${orderBookImbalance.bidPct.toFixed(0)}% — institutional support blocks SHORT`);
    } else {
      reasons.push(`Order Book: Bid/Ask ${orderBookImbalance.bidPct.toFixed(0)}/${orderBookImbalance.askPct.toFixed(0)} — balanced`);
    }
  }

  // --- Liquidity sweep detection ---
  const bullishSweep = hasBullishSweep(liquiditySweeps);
  const bearishSweep = hasBearishSweep(liquiditySweeps);
  const liquidityGrab = bullishSweep || bearishSweep;
  if (bullishSweep) {
    reasons.push('Liquidity Grab: Resistance sweep — false breakout above recent highs, bearish reversal signal');
    bearScore += 2;
  }
  if (bearishSweep) {
    reasons.push('Liquidity Grab: Support sweep — false breakdown below recent lows, bullish reversal signal');
    bullScore += 2;
  }

  // --- CVD (Cumulative Volume Delta) ---
  const cvdBullish = institutional.cvdRising && institutional.cvd > 0;
  const cvdBearish = institutional.cvdFalling && institutional.cvd < 0;
  if (cvdBullish) {
    reasons.push(`CVD rising (+${institutional.cvd.toFixed(1)}) — aggressive buy absorption`);
    bullScore += 1.5;
  } else if (cvdBearish) {
    reasons.push(`CVD falling (${institutional.cvd.toFixed(1)}) — aggressive sell absorption`);
    bearScore += 1.5;
  }

  // --- News sentiment ---
  let newsAgrees = true;
  if (sentiment) {
    if (sentiment.label === 'Bullish') {
      reasons.push(`News sentiment bullish (${sentiment.score.toFixed(0)}) — favorable backdrop`);
      bullScore += 1.5;
    } else if (sentiment.label === 'Bearish') {
      reasons.push(`News sentiment bearish (${sentiment.score.toFixed(0)}) — adverse backdrop`);
      bearScore += 1.5;
    } else {
      reasons.push(`News sentiment neutral (${sentiment.score.toFixed(0)}) — no directional bias`);
    }
  }

  let action: ScalpAction = 'WAIT';
  let confidence = 50;
  const direction = bullScore > bearScore ? 1 : bearScore > bullScore ? -1 : 0;

  if (bullScore > bearScore + 1.5) {
    action = 'QUICK BUY';
    confidence = Math.min(95, 50 + (bullScore - bearScore) * 12);
  } else if (bearScore > bullScore + 1.5) {
    action = 'QUICK SELL';
    confidence = Math.min(95, 50 + (bearScore - bullScore) * 12);
  } else {
    action = 'WAIT';
    confidence = 50;
  }

  // --- 200 EMA trend filter enforcement ---
  let finalDirection = direction;
  if (finalDirection > 0 && !aboveEma200) {
    reasons.push('BLOCKED: QUICK BUY blocked — price below 200 EMA (counter-trend)');
    finalDirection = 0;
  }
  if (finalDirection < 0 && aboveEma200) {
    reasons.push('BLOCKED: QUICK SELL blocked — price above 200 EMA (counter-trend)');
    finalDirection = 0;
  }

  // --- MTF alignment enforcement ---
  if (finalDirection > 0 && mtf15mCandles && !mtfBullish) {
    reasons.push('BLOCKED: QUICK BUY blocked — 15m trend not bullish (MTF misalignment)');
    finalDirection = 0;
  }
  if (finalDirection < 0 && mtf15mCandles && mtfBullish) {
    reasons.push('BLOCKED: QUICK SELL blocked — 15m trend not bearish (MTF misalignment)');
    finalDirection = 0;
  }

  // --- Confluence rule: news must agree ---
  if (finalDirection > 0 && sentiment && sentiment.label !== 'Bullish') {
    newsAgrees = false;
    reasons.push('CONFLICT: QUICK BUY requires bullish news sentiment (>60%) — disagreement triggers WAIT');
    finalDirection = 0;
  }
  if (finalDirection < 0 && sentiment && sentiment.label !== 'Bearish') {
    newsAgrees = false;
    reasons.push('CONFLICT: QUICK SELL requires bearish news sentiment (>60%) — disagreement triggers WAIT');
    finalDirection = 0;
  }

  // --- Order book imbalance enforcement ---
  if (finalDirection > 0 && orderBookImbalance?.blockLong) {
    orderBookOk = false;
    reasons.push('BLOCKED: QUICK BUY blocked — ask wall > 65% (heavy institutional resistance)');
    finalDirection = 0;
  }
  if (finalDirection < 0 && orderBookImbalance?.blockShort) {
    orderBookOk = false;
    reasons.push('BLOCKED: QUICK SELL blocked — bid wall > 65% (heavy institutional support)');
    finalDirection = 0;
  }

  // --- Open Interest filter: confirm breakout with rising OI ---
  let oiOk = true;
  const oiRising = institutional.oiChangePct != null && institutional.oiChangePct > 0.1;
  const oiFalling = institutional.oiChangePct != null && institutional.oiChangePct < -0.1;

  if (finalDirection > 0 && oiFalling) {
    oiOk = false;
    reasons.push(`BLOCKED: QUICK BUY blocked — Open Interest falling (${institutional.oiChangePct!.toFixed(2)}%), no new positions fueling breakout`);
    finalDirection = 0;
  }
  if (finalDirection < 0 && oiFalling) {
    oiOk = false;
    reasons.push(`BLOCKED: QUICK SELL blocked — Open Interest falling (${institutional.oiChangePct!.toFixed(2)}%), no new positions fueling breakdown`);
    finalDirection = 0;
  }
  if (finalDirection > 0 && oiRising) {
    reasons.push(`OI rising (+${institutional.oiChangePct!.toFixed(2)}%) — new longs entering, confirms breakout`);
  }
  if (finalDirection < 0 && oiRising) {
    reasons.push(`OI rising (+${institutional.oiChangePct!.toFixed(2)}%) — new shorts entering, confirms breakdown`);
  }

  if (finalDirection === 0 && (action === 'QUICK BUY' || action === 'QUICK SELL')) {
    action = 'CONFLICT';
    confidence = 50;
  } else if (finalDirection === 0) {
    action = 'WAIT';
    confidence = 50;
  }

  // --- Dynamic ATR stop loss (1.5x ATR for scalp, beyond wick zone) ---
  const atrSlDist = Math.max(atr * 1.5, price * 0.002);
  const slPct = atrSlDist / price;
  const tp1Pct = slPct * 1.5;
  const tp2Pct = slPct * 2.5;

  const entry = price;
  const halfSpread = Math.max(atr * 0.15, price * 0.0008);
  const entryLow = entry - halfSpread;
  const entryHigh = entry + halfSpread;
  const stopLoss = entry * (1 + finalDirection * -slPct);
  const tp1 = entry * (1 + finalDirection * tp1Pct);
  const tp2 = entry * (1 + finalDirection * tp2Pct);

  if (finalDirection !== 0) {
    reasons.push(`Execution Range: ${fmtPriceVal(entryLow)} – ${fmtPriceVal(entryHigh)} (1-2 min window to execute)`);
  }

  const rrTp1 = tp1Pct / slPct;
  const rrTp2 = tp2Pct / slPct;

  const cfg = mode !== 'normal' ? SCALP_LEVERAGE_CONFIGS[mode] : null;
  const leverage = cfg ? cfg.leverage : 1;
  const liqPctVal = cfg ? cfg.liqPct : 0;
  const liquidationPrice = entry * (1 + finalDirection * -liqPctVal);
  const leverageRoiTp1 = ((tp1 - entry) / entry) * 100 * leverage * finalDirection;
  const leverageRoiTp2 = ((tp2 - entry) / entry) * 100 * leverage * finalDirection;
  const leverageRiskPct = ((entry - stopLoss) / entry) * 100 * leverage * finalDirection;

  if (cfg) {
    reasons.push(
      `${cfg.label} leverage: SL at ${(slPct * 100).toFixed(2)}% limits risk to ${Math.abs(leverageRiskPct).toFixed(1)}% loss; liq ≈ ${(cfg.liqPct * 100).toFixed(1)}% adverse move`
    );
  }

  // --- Confluence checks ---
  const checks: ConfluenceCheck[] = [
    { label: 'Technical Setup', passed: finalDirection !== 0 },
    { label: 'News Sentiment', passed: newsAgrees && finalDirection !== 0 },
    { label: '200 EMA Trend', passed: finalDirection !== 0 },
    { label: 'MTF 15m Aligned', passed: mtfAligned && finalDirection !== 0 },
    { label: 'Volume > 1.3x', passed: volumeOk },
    { label: 'Order Book OK', passed: orderBookOk && finalDirection !== 0 },
    { label: 'Liquidity Grab', passed: liquidityGrab && finalDirection !== 0 },
    { label: 'OI Confirming', passed: oiOk && finalDirection !== 0 },
    { label: 'CVD Absorption', passed: (cvdBullish || cvdBearish) && finalDirection !== 0 },
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
    ema5,
    ema13,
    ema200,
    rsi7,
    crossover: cross,
    reasons,
    timeframe,
    mode,
    leverage,
    liquidationPrice,
    leverageRoiTp1,
    leverageRoiTp2,
    leverageRiskPct,
    rrTp1,
    rrTp2,
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
