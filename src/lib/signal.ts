import type { Candle } from './binance';
import { ema, rsi, detectCrossover, avgTrueRange, avgVolume, type Crossover } from './indicators';
import type { SentimentSummary, HighImpactEvent } from './news';
import type { OrderBookImbalance, InstitutionalData } from './orderbook';
import { emptyInstitutionalData } from './orderbook';

export type Action = 'BUY' | 'SELL' | 'NEUTRAL' | 'EVENT PAUSE' | 'CONFLICT';
export type SignalMode = 'normal' | 'leverage5x' | 'leverage10x';

export interface TradeSignal {
  action: Action;
  confidence: number;
  entry: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskReward: number;
  reasons: string[];
  ema9: number;
  ema21: number;
  ema200: number;
  rsi: number;
  crossover: Crossover;
  sentimentLabel: string;
  sentimentScore: number;
  mode: SignalMode;
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
  orderBookImbalance: OrderBookImbalance | null;
  institutional: InstitutionalData;
  candleCloseTime: number;
}

interface ConfluenceCheck {
  label: string;
  passed: boolean;
}

interface LeverageConfig {
  leverage: number;
  slPct: number;
  tp1Pct: number;
  tp2Pct: number;
  liqPct: number;
  label: string;
}

const LEVERAGE_CONFIGS: Record<Exclude<SignalMode, 'normal'>, LeverageConfig> = {
  leverage5x: {
    leverage: 5,
    slPct: 0.015,
    tp1Pct: 0.03,
    tp2Pct: 0.06,
    liqPct: 0.19,
    label: '5x',
  },
  leverage10x: {
    leverage: 10,
    slPct: 0.0075,
    tp1Pct: 0.015,
    tp2Pct: 0.03,
    liqPct: 0.095,
    label: '10x',
  },
};

export function computeSignal(
  candles: Candle[],
  sentiment: SentimentSummary,
  mode: SignalMode = 'normal',
  highImpactEvents: HighImpactEvent[] = [],
  orderBookImbalance: OrderBookImbalance | null = null,
  institutional: InstitutionalData = emptyInstitutionalData()
): TradeSignal | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const ema9Arr = ema(closes, 9);
  const ema21Arr = ema(closes, 21);
  const ema200Arr = ema(closes, 200);
  const rsiArr = rsi(closes, 14);
  const last = candles[candles.length - 1];
  const price = last.close;
  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const ema200 = ema200Arr[ema200Arr.length - 1];
  const rsiVal = rsiArr[rsiArr.length - 1];
  const cross = detectCrossover(ema9Arr, ema21Arr, 4);
  const atr = avgTrueRange(candles, 14);
  const volAvg = avgVolume(candles, 20);
  const volRatio = volAvg > 0 ? last.volume / volAvg : 1;
  const aboveEma200 = price > ema200;

  const reasons: string[] = [];
  let bullScore = 0;
  let bearScore = 0;

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
      riskReward: 0,
      reasons,
      ema9,
      ema21,
      ema200,
      rsi: rsiVal,
      crossover: cross,
      sentimentLabel: sentiment.label,
      sentimentScore: sentiment.score,
      mode,
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
      orderBookImbalance,
      institutional,
      candleCloseTime: last.time,
    };
  }

  // --- 200 EMA trend filter ---
  if (aboveEma200) {
    reasons.push('Price above 200 EMA — macro uptrend, longs preferred');
    bullScore += 1.5;
  } else {
    reasons.push('Price below 200 EMA — macro downtrend, shorts preferred');
    bearScore += 1.5;
  }

  // --- EMA crossover ---
  if (cross === 'bullish') {
    reasons.push('EMA9 crossed above EMA21 — bullish momentum shift');
    bullScore += 2;
  } else if (cross === 'bearish') {
    reasons.push('EMA9 crossed below EMA21 — bearish momentum shift');
    bearScore += 2;
  } else if (ema9 > ema21) {
    reasons.push('EMA9 above EMA21 — uptrend structure intact');
    bullScore += 1;
  } else {
    reasons.push('EMA9 below EMA21 — downtrend structure intact');
    bearScore += 1;
  }

  // --- RSI ---
  if (rsiVal < 35) {
    reasons.push(`RSI at ${rsiVal.toFixed(0)} — oversold pullback entry`);
    bullScore += 1.5;
  } else if (rsiVal > 65) {
    reasons.push(`RSI at ${rsiVal.toFixed(0)} — overbought, risk of pullback`);
    bearScore += 1.5;
  } else if (rsiVal >= 45 && rsiVal <= 55) {
    reasons.push(`RSI at ${rsiVal.toFixed(0)} — neutral zone, no momentum edge`);
  } else if (rsiVal > 55) {
    reasons.push(`RSI at ${rsiVal.toFixed(0)} — bullish momentum building`);
    bullScore += 0.5;
  } else {
    reasons.push(`RSI at ${rsiVal.toFixed(0)} — bearish momentum building`);
    bearScore += 0.5;
  }

  // --- Volume confirmation ---
  const volumeOk = volRatio >= 1.3;
  if (volumeOk) {
    reasons.push(`Volume ${volRatio.toFixed(1)}x avg — strong participation confirms move`);
    bullScore += 0.5;
    bearScore += 0.5;
  } else {
    reasons.push(`Volume ${volRatio.toFixed(1)}x avg — below 1.3x threshold, weak confirmation`);
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

  // --- CVD (Cumulative Volume Delta) ---
  const cvdBullish = institutional.cvdRising && institutional.cvd > 0;
  const cvdBearish = institutional.cvdFalling && institutional.cvd < 0;
  if (cvdBullish) {
    reasons.push(`CVD rising (+${institutional.cvd.toFixed(1)}) — aggressive buy absorption`);
    bullScore += 1.5;
  } else if (cvdBearish) {
    reasons.push(`CVD falling (${institutional.cvd.toFixed(1)}) — aggressive sell absorption`);
    bearScore += 1.5;
  } else {
    reasons.push(`CVD neutral (${institutional.cvd.toFixed(1)}) — no aggressive absorption`);
  }

  // --- News sentiment ---
  if (sentiment.label === 'Bullish') {
    reasons.push(`News sentiment bullish (${sentiment.score.toFixed(0)}) — favorable macro backdrop`);
    bullScore += 1.5;
  } else if (sentiment.label === 'Bearish') {
    reasons.push(`News sentiment bearish (${sentiment.score.toFixed(0)}) — adverse macro backdrop`);
    bearScore += 1.5;
  } else {
    reasons.push(`News sentiment neutral (${sentiment.score.toFixed(0)}) — no directional bias`);
  }

  let action: Action = 'NEUTRAL';
  let confidence = 50;
  const entry = price;
  const halfSpread = Math.max(atr * 0.2, price * 0.001);
  const entryLow = entry - halfSpread;
  const entryHigh = entry + halfSpread;
  let stopLoss = price;
  let tp1 = price;
  let tp2 = price;
  let riskReward = 2;
  let rrTp1 = 2;
  let rrTp2 = 4;

  const isBuy = bullScore > bearScore + 1.5;
  const isSell = bearScore > bullScore + 1.5;
  let direction = isBuy ? 1 : isSell ? -1 : 0;

  // --- 200 EMA trend filter enforcement ---
  if (isBuy && !aboveEma200) {
    reasons.push('BLOCKED: BUY signal blocked — price below 200 EMA (counter-trend)');
    direction = 0;
  }
  if (isSell && aboveEma200) {
    reasons.push('BLOCKED: SELL signal blocked — price above 200 EMA (counter-trend)');
    direction = 0;
  }

  // --- Confluence rule: news must agree ---
  let newsAgrees = true;
  if (direction > 0 && sentiment.label !== 'Bullish') {
    newsAgrees = false;
    reasons.push('CONFLICT: BUY requires bullish news sentiment (>60%) — disagreement triggers WAIT');
    direction = 0;
  }
  if (direction < 0 && sentiment.label !== 'Bearish') {
    newsAgrees = false;
    reasons.push('CONFLICT: SELL requires bearish news sentiment (>60%) — disagreement triggers WAIT');
    direction = 0;
  }

  // --- Order book imbalance enforcement ---
  if (direction > 0 && orderBookImbalance?.blockLong) {
    orderBookOk = false;
    reasons.push('BLOCKED: BUY blocked — ask wall > 65% (heavy institutional resistance)');
    direction = 0;
  }
  if (direction < 0 && orderBookImbalance?.blockShort) {
    orderBookOk = false;
    reasons.push('BLOCKED: SELL blocked — bid wall > 65% (heavy institutional support)');
    direction = 0;
  }

  // --- Dynamic ATR stop loss (2.0x ATR for intraday, beyond wick zone) ---
  const slDist = Math.max(atr * 2.0, price * 0.008);
  const tp1Dist = slDist * 1.5;
  const tp2Dist = slDist * 2.5;

  if (mode !== 'normal') {
    const cfg = LEVERAGE_CONFIGS[mode];
    stopLoss = entry * (1 + direction * -cfg.slPct);
    tp1 = entry * (1 + direction * cfg.tp1Pct);
    tp2 = entry * (1 + direction * cfg.tp2Pct);
    rrTp1 = cfg.tp1Pct / cfg.slPct;
    rrTp2 = cfg.tp2Pct / cfg.slPct;
    riskReward = rrTp1;
    reasons.push(
      `${cfg.label} leverage: SL at ${(cfg.slPct * 100).toFixed(2)}% limits risk to ${(cfg.slPct * cfg.leverage * 100).toFixed(1)}% loss; liq ≈ ${(cfg.liqPct * 100).toFixed(1)}% adverse move`
    );
  } else {
    stopLoss = entry + direction * -slDist;
    tp1 = entry + direction * tp1Dist;
    tp2 = entry + direction * tp2Dist;
    rrTp1 = 1.5;
    rrTp2 = 2.5;
    riskReward = 1.5;
  }

  const cfg = mode !== 'normal' ? LEVERAGE_CONFIGS[mode] : null;
  const leverage = cfg ? cfg.leverage : 1;
  const liqPctVal = cfg ? cfg.liqPct : 0;
  const liquidationPrice = entry * (1 + direction * -liqPctVal);
  const leverageRoiTp1 = ((tp1 - entry) / entry) * 100 * leverage * direction;
  const leverageRoiTp2 = ((tp2 - entry) / entry) * 100 * leverage * direction;
  const leverageRiskPct = ((entry - stopLoss) / entry) * 100 * leverage * direction;

  // --- Open Interest filter: confirm breakout with rising OI ---
  let oiOk = true;
  const oiRising = institutional.oiChangePct != null && institutional.oiChangePct > 0.1;
  const oiFalling = institutional.oiChangePct != null && institutional.oiChangePct < -0.1;

  if (direction > 0 && oiFalling) {
    oiOk = false;
    reasons.push(`BLOCKED: BUY blocked — Open Interest falling (${institutional.oiChangePct!.toFixed(2)}%), no new positions fueling breakout`);
    direction = 0;
  }
  if (direction < 0 && oiFalling) {
    oiOk = false;
    reasons.push(`BLOCKED: SELL blocked — Open Interest falling (${institutional.oiChangePct!.toFixed(2)}%), no new positions fueling breakdown`);
    direction = 0;
  }
  if (direction > 0 && oiRising) {
    reasons.push(`OI rising (+${institutional.oiChangePct!.toFixed(2)}%) — new longs entering, confirms breakout`);
  }
  if (direction < 0 && oiRising) {
    reasons.push(`OI rising (+${institutional.oiChangePct!.toFixed(2)}%) — new shorts entering, confirms breakdown`);
  }

  if (direction !== 0) {
    action = direction > 0 ? 'BUY' : 'SELL';
    confidence = Math.min(95, 50 + Math.abs(bullScore - bearScore) * 10);
    reasons.push(`Execution Range: ${fmtPriceVal(entryLow)} – ${fmtPriceVal(entryHigh)} (1-2 min window to execute)`);
  } else if (isBuy || isSell) {
    action = 'CONFLICT';
    confidence = 50;
  } else {
    action = 'NEUTRAL';
    confidence = 50;
  }

  // --- Confluence checks ---
  const checks: ConfluenceCheck[] = [
    { label: 'Technical Setup', passed: direction !== 0 },
    { label: 'News Sentiment', passed: newsAgrees && direction !== 0 },
    { label: '200 EMA Trend', passed: direction !== 0 },
    { label: 'Volume > 1.3x', passed: volumeOk },
    { label: 'Order Book OK', passed: orderBookOk && direction !== 0 },
    { label: 'OI Confirming', passed: oiOk && direction !== 0 },
    { label: 'CVD Absorption', passed: (cvdBullish || cvdBearish) && direction !== 0 },
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
    riskReward,
    reasons,
    ema9,
    ema21,
    ema200,
    rsi: rsiVal,
    crossover: cross,
    sentimentLabel: sentiment.label,
    sentimentScore: sentiment.score,
    mode,
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
    orderBookImbalance,
    institutional,
    candleCloseTime: last.time,
  };
}

function fmtPriceVal(p: number): string {
  return p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p.toFixed(6);
}
