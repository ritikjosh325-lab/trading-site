import { Activity, TrendingUp, TrendingDown, Minus, Target, Shield, Zap, Flame, Gauge, CheckCircle2, XCircle, AlertOctagon, BarChart3 } from 'lucide-react';
import type { TradeSignal, SignalMode } from '@/lib/signal';
import type { OrderBookImbalance } from '@/lib/orderbook';
import { OrderBookBar } from '@/components/ScalpSignalCard';
import { fmtPrice } from '@/lib/format';

interface Props {
  signal: TradeSignal | null;
  symbol: string;
  mode: SignalMode;
  onModeChange: (mode: SignalMode) => void;
  orderBookImbalance: OrderBookImbalance | null;
  wsConnected: boolean;
  pulse: boolean;
}

export function SignalCard({ signal, symbol, mode, onModeChange, orderBookImbalance, wsConnected, pulse }: Props) {
  const isLeverage = mode !== 'normal';
  const leverageLabel = mode === 'leverage10x' ? '10x' : mode === 'leverage5x' ? '5x' : '';

  if (!signal) {
    return (
      <div className="panel p-5">
        <ModeSwitcher mode={mode} onModeChange={onModeChange} />
        <div className="text-gray-500 text-sm mt-4">Computing AI signal for {symbol}…</div>
        <OrderBookBar imbalance={orderBookImbalance} connected={wsConnected} />
      </div>
    );
  }

  const isEventPause = signal.action === 'EVENT PAUSE';
  const isBuy = signal.action === 'BUY';
  const isSell = signal.action === 'SELL';
  const isNeutral = signal.action === 'NEUTRAL';
  const isConflict = signal.action === 'CONFLICT';

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
            <h3 className="text-sm font-semibold text-gray-200">AI Intraday Signal</h3>
            <p className="text-xs text-gray-500">{symbol} · 15m timeframe</p>
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
            className={`h-full rounded-full transition-all duration-700 ${isBuy ? 'bg-accent-green' : isSell ? 'bg-accent-red' : 'bg-accent-amber'}`}
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
            <span className="text-xs text-gray-500">Take Profit 1</span>
          </div>
          <div className="font-mono font-semibold text-accent-green">${fmtPrice(signal.tp1)}</div>
          <div className="text-xs text-gray-600 font-mono">{tp1Pct >= 0 ? '+' : ''}{tp1Pct.toFixed(2)}%</div>
        </div>
        <div className="panel-raised p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-accent-green" />
            <span className="text-xs text-gray-500">Take Profit 2</span>
          </div>
          <div className="font-mono font-semibold text-accent-green">${fmtPrice(signal.tp2)}</div>
          <div className="text-xs text-gray-600 font-mono">{tp2Pct >= 0 ? '+' : ''}{tp2Pct.toFixed(2)}%</div>
        </div>
      </div>

      {/* 200 EMA & Volume stats */}
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
          <div className="text-xs text-gray-500">Trend</div>
          <div className={`text-xs font-mono font-semibold ${signal.aboveEma200 ? 'text-accent-green' : 'text-accent-red'}`}>
            {signal.aboveEma200 ? 'Bullish' : 'Bearish'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-3 py-2 bg-bg-raised rounded-lg">
        <span className="text-xs text-gray-500">Risk : Reward Ratio</span>
        <span className="text-sm font-mono font-bold text-accent-cyan">
          1 : {signal.rrTp1.toFixed(1)} / 1 : {signal.rrTp2.toFixed(1)}
        </span>
      </div>

      {isLeverage && !isEventPause && (
        <div className="mb-3 p-3 rounded-lg bg-accent-red/5 border border-accent-red/20 space-y-2.5 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-accent-red" />
            <span className="text-xs font-semibold text-accent-red">{leverageLabel} Leverage Mode</span>
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
                {signal.leverageRiskPct >= 0 ? '-' : '+'}{Math.abs(signal.leverageRiskPct).toFixed(1)}%
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
            Warning: A {Math.abs(liqPct).toFixed(1)}% adverse price move triggers full liquidation. SL must be hit first to limit loss to {Math.abs(signal.leverageRiskPct).toFixed(0)}%.
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Activity className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-500">Trade Rationale</span>
        </div>
        {signal.reasons.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
            <span className="text-accent-blue mt-0.5">▸</span>
            <span>{r}</span>
          </div>
        ))}
      </div>

      {isNeutral && (
        <div className="mt-3 px-3 py-2 bg-accent-amber/5 border border-accent-amber/20 rounded-lg text-xs text-accent-amber">
          No high-conviction setup detected. Waiting for EMA crossover, 200 EMA alignment, volume confirmation, and news confluence.
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

function ModeSwitcher({ mode, onModeChange }: { mode: SignalMode; onModeChange: (m: SignalMode) => void }) {
  const modes: { value: SignalMode; label: string; activeClass: string; Icon: typeof Shield }[] = [
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
