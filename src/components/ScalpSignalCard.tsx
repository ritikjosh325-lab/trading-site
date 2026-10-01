import { Activity, TrendingUp, TrendingDown, Minus, Target, Shield, Zap, Gauge, Layers, Flame, CheckCircle2, XCircle, AlertOctagon, BarChart3, BookOpen } from 'lucide-react';
import type { ScalpSignal, ScalpTimeframe, ScalpMode } from '@/lib/scalp';
import type { OrderBookImbalance } from '@/lib/orderbook';
import { fmtPrice } from '@/lib/format';

interface Props {
  signal: ScalpSignal | null;
  symbol: string;
  timeframe: ScalpTimeframe;
  onTimeframeChange: (tf: ScalpTimeframe) => void;
  mode: ScalpMode;
  onModeChange: (mode: ScalpMode) => void;
  orderBookImbalance: OrderBookImbalance | null;
  wsConnected: boolean;
  pulse: boolean;
}

const TIMEFRAMES: ScalpTimeframe[] = ['1m', '3m', '5m'];

export function ScalpSignalCard({ signal, symbol, timeframe, onTimeframeChange, mode, onModeChange, orderBookImbalance, wsConnected, pulse }: Props) {
  if (!signal) {
    return (
      <div className="panel p-5">
        <ScalpHeader symbol={symbol} />
        <TimeframeSelector timeframe={timeframe} onTimeframeChange={onTimeframeChange} />
        <ModeSwitcher mode={mode} onModeChange={onModeChange} />
        <div className="text-gray-500 text-sm mt-4">Computing scalp signal for {symbol}…</div>
        <OrderBookBar imbalance={orderBookImbalance} connected={wsConnected} />
      </div>
    );
  }

  const isEventPause = signal.action === 'EVENT PAUSE';
  const isBuy = signal.action === 'QUICK BUY';
  const isSell = signal.action === 'QUICK SELL';
  const isWait = signal.action === 'WAIT';
  const isConflict = signal.action === 'CONFLICT';
  const isLeverage = mode !== 'normal';
  const leverageLabel = mode === 'leverage10x' ? '10x' : mode === 'leverage5x' ? '5x' : '';

  const actionColor = isBuy ? 'text-accent-green' : isSell ? 'text-accent-red' : 'text-accent-amber';
  const actionBg = isBuy ? 'bg-accent-green/10 border-accent-green/30' : isSell ? 'bg-accent-red/10 border-accent-red/30' : 'bg-accent-amber/10 border-accent-amber/30';
  const glowClass = isBuy ? 'glow-green' : isSell ? 'glow-red' : '';
  const ActionIcon = isBuy ? TrendingUp : isSell ? TrendingDown : Minus;

  const tp1Pct = ((signal.tp1 - signal.entry) / signal.entry) * 100;
  const tp2Pct = ((signal.tp2 - signal.entry) / signal.entry) * 100;
  const slPct = ((signal.stopLoss - signal.entry) / signal.entry) * 100;
  const liqPct = ((signal.liquidationPrice - signal.entry) / signal.entry) * 100;

  return (
    <div className={`panel p-5 ${glowClass} ${pulse ? 'signal-pulse' : ''} animate-fade-in`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-bg-raised flex items-center justify-center">
            <Zap className="w-4 h-4 text-accent-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-200">AI Scalp Signal</h3>
            <p className="text-xs text-gray-500">{symbol} · {signal.timeframe} timeframe</p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border ${actionBg} flex items-center gap-1.5`}>
          <ActionIcon className={`w-4 h-4 ${actionColor}`} />
          <span className={`font-bold text-sm ${actionColor}`}>{signal.action}</span>
          {pulse && <span className="ml-1 text-xs text-accent-amber animate-ping">NEW</span>}
        </div>
      </div>

      {/* Market Status Banner */}
      <div className={`mb-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-semibold ${
        isEventPause
          ? 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
          : 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
      }`}>
        {isEventPause ? <AlertOctagon className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        {isEventPause ? 'EVENT PAUSE / NO TRADE' : 'SAFE TO TRADE'}
      </div>

      <TimeframeSelector timeframe={timeframe} onTimeframeChange={onTimeframeChange} />
      <ModeSwitcher mode={mode} onModeChange={onModeChange} />

      <OrderBookBar imbalance={signal.orderBookImbalance ?? orderBookImbalance} connected={wsConnected} />

      {/* Confluence Score & Checkmarks */}
      {!isEventPause && (
        <div className="mb-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Confluence Score</span>
            <span className="text-xs font-mono font-semibold text-gray-300">
              {signal.confluenceScore}/{signal.checks.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {signal.checks.map((check, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                  check.passed
                    ? 'bg-accent-green/10 text-accent-green'
                    : 'bg-accent-red/10 text-accent-red'
                }`}
              >
                {check.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {check.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Confidence</span>
          <span className="text-xs font-mono font-semibold text-gray-300">{signal.confidence.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-bg-raised rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isBuy ? 'bg-accent-green' : isSell ? 'bg-accent-red' : 'bg-accent-amber'}`}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="panel-raised p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-accent-blue" />
            <span className="text-xs text-gray-500">Execution Range</span>
          </div>
          <div className="font-mono font-semibold text-gray-200 text-sm">${fmtPrice(signal.entryLow)}</div>
          <div className="font-mono text-xs text-gray-500">to ${fmtPrice(signal.entryHigh)}</div>
          <div className="text-xs text-accent-amber font-mono mt-0.5">~1-2 min window</div>
        </div>
        <div className="panel-raised p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="w-3 h-3 text-accent-red" />
            <span className="text-xs text-gray-500">Stop Loss (ATR)</span>
          </div>
          <div className="font-mono font-semibold text-accent-red">${fmtPrice(signal.stopLoss)}</div>
          <div className="text-xs text-gray-600 font-mono">{slPct >= 0 ? '+' : ''}{slPct.toFixed(2)}%</div>
        </div>
        <div className="panel-raised p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-accent-green" />
            <span className="text-xs text-gray-500">Quick TP1</span>
          </div>
          <div className="font-mono font-semibold text-accent-green">${fmtPrice(signal.tp1)}</div>
          <div className="text-xs text-gray-600 font-mono">{tp1Pct >= 0 ? '+' : ''}{tp1Pct.toFixed(2)}%</div>
        </div>
        <div className="panel-raised p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-accent-green" />
            <span className="text-xs text-gray-500">Quick TP2</span>
          </div>
          <div className="font-mono font-semibold text-accent-green">${fmtPrice(signal.tp2)}</div>
          <div className="text-xs text-gray-600 font-mono">{tp2Pct >= 0 ? '+' : ''}{tp2Pct.toFixed(2)}%</div>
        </div>
      </div>

      {/* Indicator stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Layers className="w-3 h-3" /> VWAP
          </div>
          <div className="text-xs font-mono font-semibold text-gray-300">${fmtPrice(signal.vwap)}</div>
        </div>
        <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
          <div className="text-xs text-gray-500">EMA 5/13</div>
          <div className="text-xs font-mono font-semibold text-gray-300">
            {signal.ema5.toFixed(2)} / {signal.ema13.toFixed(2)}
          </div>
        </div>
        <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Gauge className="w-3 h-3" /> RSI(7)
          </div>
          <div className="text-xs font-mono font-semibold text-gray-300">{signal.rsi7.toFixed(0)}</div>
        </div>
      </div>

      {/* 200 EMA, Volume, MTF stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
          <div className="text-xs text-gray-500">200 EMA</div>
          <div className="text-xs font-mono font-semibold text-gray-300">${fmtPrice(signal.ema200)}</div>
        </div>
        <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <BarChart3 className="w-3 h-3" /> Vol Ratio
          </div>
          <div className={`text-xs font-mono font-semibold ${signal.volumeRatio >= 1.3 ? 'text-accent-green' : 'text-accent-amber'}`}>
            {signal.volumeRatio.toFixed(1)}x
          </div>
        </div>
        <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
          <div className="text-xs text-gray-500">15m MTF</div>
          <div className={`text-xs font-mono font-semibold ${signal.mtfAligned ? 'text-accent-green' : 'text-accent-amber'}`}>
            {signal.mtfAligned ? 'Aligned' : 'Check'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-3 py-2 bg-bg-raised rounded-lg">
        <span className="text-xs text-gray-500">Risk : Reward</span>
        <span className="text-sm font-mono font-bold text-accent-cyan">
          1 : {signal.rrTp1.toFixed(1)} / 1 : {signal.rrTp2.toFixed(1)}
        </span>
      </div>

      {isLeverage && !isEventPause && (
        <div className="mb-3 p-3 rounded-lg bg-accent-red/5 border border-accent-red/20 space-y-2.5 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-accent-red" />
            <span className="text-xs font-semibold text-accent-red">{leverageLabel} Scalp Leverage</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Gauge className="w-3 h-3" /> Expected ROI (TP1)
              </div>
              <div className="text-sm font-mono font-bold text-accent-green">
                {signal.leverageRoiTp1 >= 0 ? '+' : ''}{signal.leverageRoiTp1.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Gauge className="w-3 h-3" /> Expected ROI (TP2)
              </div>
              <div className="text-sm font-mono font-bold text-accent-green">
                {signal.leverageRoiTp2 >= 0 ? '+' : ''}{signal.leverageRoiTp2.toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Max Risk (SL hit)</div>
              <div className="text-sm font-mono font-bold text-accent-red">
                -{Math.abs(signal.leverageRiskPct).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Liquidation Level
              </div>
              <div className="text-sm font-mono font-bold text-accent-red">${fmtPrice(signal.liquidationPrice)}</div>
              <div className="text-xs text-gray-600 font-mono">{liqPct >= 0 ? '+' : ''}{liqPct.toFixed(1)}% move</div>
            </div>
          </div>
          <div className="text-xs text-accent-red/80 pt-1 border-t border-accent-red/10">
            Warning: A {Math.abs(liqPct).toFixed(1)}% adverse price move triggers full liquidation. SL must be hit first to limit loss to {Math.abs(signal.leverageRiskPct).toFixed(1)}%.
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Activity className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-500">Scalp Rationale</span>
        </div>
        {signal.reasons.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
            <span className="text-accent-blue mt-0.5">▸</span>
            <span>{r}</span>
          </div>
        ))}
      </div>

      {isWait && (
        <div className="mt-3 px-3 py-2 bg-accent-amber/5 border border-accent-amber/20 rounded-lg text-xs text-accent-amber">
          No scalp setup detected. Waiting for 5/13 EMA crossover + VWAP alignment + 200 EMA trend + volume confirmation + MTF alignment.
        </div>
      )}

      {isConflict && (
        <div className="mt-3 px-3 py-2 bg-accent-amber/5 border border-accent-amber/20 rounded-lg text-xs text-accent-amber">
          WAIT / CONFLICT: Technical setup and news sentiment disagree. No trade until alignment.
        </div>
      )}
    </div>
  );
}

function ScalpHeader({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-bg-raised flex items-center justify-center">
          <Zap className="w-4 h-4 text-accent-cyan" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-200">AI Scalp Signal</h3>
          <p className="text-xs text-gray-500">{symbol} · fast timeframe</p>
        </div>
      </div>
    </div>
  );
}

function TimeframeSelector({ timeframe, onTimeframeChange }: { timeframe: ScalpTimeframe; onTimeframeChange: (tf: ScalpTimeframe) => void }) {
  return (
    <div className="flex p-1 bg-bg-raised rounded-lg border border-bg-border mb-3">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            timeframe === tf
              ? 'bg-accent-cyan text-bg-base font-bold shadow'
              : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

function ModeSwitcher({ mode, onModeChange }: { mode: ScalpMode; onModeChange: (m: ScalpMode) => void }) {
  const modes: { value: ScalpMode; label: string; activeClass: string; Icon: typeof Shield }[] = [
    { value: 'normal', label: 'Spot 1x', activeClass: 'bg-accent-blue text-white shadow', Icon: Shield },
    { value: 'leverage5x', label: '5x Lev', activeClass: 'bg-accent-amber text-white shadow', Icon: Flame },
    { value: 'leverage10x', label: '10x Lev', activeClass: 'bg-accent-red text-white shadow glow-red', Icon: Flame },
  ];
  return (
    <div className="flex p-1 bg-bg-raised rounded-lg border border-bg-border">
      {modes.map(({ value, label, activeClass, Icon }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === value ? activeClass : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function OrderBookBar({ imbalance, connected }: { imbalance: OrderBookImbalance | null; connected: boolean }) {
  if (!imbalance) {
    return (
      <div className="mb-3 mt-3 px-3 py-2 bg-bg-raised rounded-lg flex items-center gap-2 text-xs text-gray-500">
        <BookOpen className="w-3.5 h-3.5" />
        Order Book {connected ? 'connected' : 'connecting…'}
      </div>
    );
  }
  const bidPct = imbalance.bidPct;
  const askPct = imbalance.askPct;
  const wallLabel = imbalance.askHeavy ? 'Ask Wall — blocks LONG' : imbalance.bidHeavy ? 'Bid Wall — blocks SHORT' : 'Balanced';
  const wallColor = imbalance.askHeavy ? 'text-accent-red' : imbalance.bidHeavy ? 'text-accent-green' : 'text-gray-400';
  return (
    <div className="mb-3 mt-3 px-3 py-2.5 bg-bg-raised rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <BookOpen className="w-3.5 h-3.5" />
          Order Book Depth
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent-green' : 'bg-accent-amber'} animate-pulse`} />
        </div>
        <span className={`text-xs font-semibold ${wallColor}`}>{wallLabel}</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-bg-base">
        <div
          className="bg-accent-green/70 transition-all duration-300 flex items-center justify-center"
          style={{ width: `${bidPct}%` }}
        >
          {bidPct > 15 && <span className="text-[10px] font-mono text-white">{bidPct.toFixed(0)}%</span>}
        </div>
        <div
          className="bg-accent-red/70 transition-all duration-300 flex items-center justify-center"
          style={{ width: `${askPct}%` }}
        >
          {askPct > 15 && <span className="text-[10px] font-mono text-white">{askPct.toFixed(0)}%</span>}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-accent-green font-mono">Bids {imbalance.bidVolume.toFixed(1)}</span>
        <span className="text-gray-500 font-mono">Ratio {imbalance.ratio.toFixed(2)}</span>
        <span className="text-accent-red font-mono">Asks {imbalance.askVolume.toFixed(1)}</span>
      </div>
    </div>
  );
}
