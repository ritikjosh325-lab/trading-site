import { TrendingUp, TrendingDown, Trophy, Clock, Target, XCircle, CheckCircle2, Zap, BarChart3 } from 'lucide-react';
import type { SignalRecord, PerformanceStats, SignalStatus } from '@/hooks/useSignalHistory';
import { fmtPrice, fmtTime } from '@/lib/format';

interface Props {
  records: SignalRecord[];
  stats: PerformanceStats;
}

export function SignalHistory({ records, stats }: Props) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-bg-raised flex items-center justify-center">
            <Trophy className="w-4 h-4 text-accent-amber" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Signal History</h3>
            <p className="text-xs text-gray-500">Past 30 days · Live outcome tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WinRateBadge stats={stats} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatBox label="Total" value={stats.total.toString()} color="text-gray-300" />
        <StatBox label="Wins" value={stats.wins.toString()} color="text-accent-green" />
        <StatBox label="Losses" value={stats.losses.toString()} color="text-accent-red" />
        <StatBox label="In Progress" value={stats.inProgress.toString()} color="text-accent-amber" />
      </div>

      {records.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-600 text-sm">
          No signals logged yet. Verified BUY/SELL signals will appear here automatically.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-bg-border">
                <th className="text-left font-medium px-2 py-2">Time</th>
                <th className="text-left font-medium px-2 py-2">Symbol</th>
                <th className="text-left font-medium px-2 py-2">Signal</th>
                <th className="text-right font-medium px-2 py-2">Entry</th>
                <th className="text-center font-medium px-2 py-2">Status</th>
                <th className="text-right font-medium px-2 py-2">PnL %</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-bg-border/50 hover:bg-bg-hover/30 transition-colors">
                  <td className="px-2 py-2 text-gray-400 font-mono whitespace-nowrap">{fmtTime(r.timestamp)}</td>
                  <td className="px-2 py-2 text-gray-300 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <TradeTypeBadge type={r.type} />
                      {r.symbol.replace('USDT', '/USDT')}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <DirectionBadge direction={r.direction} />
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-gray-400 whitespace-nowrap">${fmtPrice(r.entry)}</td>
                  <td className="px-2 py-2 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-semibold whitespace-nowrap">
                    {r.pnlPct != null ? (
                      <span className={r.pnlPct >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                        {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WinRateBadge({ stats }: { stats: PerformanceStats }) {
  const resolved = stats.wins + stats.losses;
  const rate = stats.winRate;
  const color = rate >= 60 ? 'text-accent-green' : rate >= 40 ? 'text-accent-amber' : 'text-accent-red';
  const bg = rate >= 60 ? 'bg-accent-green/10 border-accent-green/30' : rate >= 40 ? 'bg-accent-amber/10 border-accent-amber/30' : 'bg-accent-red/10 border-accent-red/30';
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg}`}>
      <Trophy className={`w-3.5 h-3.5 ${color}`} />
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold ${color}`}>{resolved > 0 ? rate.toFixed(0) : '—'}%</span>
        <span className="text-xs text-gray-500">Win Rate</span>
        <span className="text-xs text-gray-600">·</span>
        <span className="text-xs text-accent-green">{stats.wins}W</span>
        <span className="text-xs text-gray-600">/</span>
        <span className="text-xs text-accent-red">{stats.losses}L</span>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-2 py-1.5 bg-bg-raised rounded-lg text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}

function TradeTypeBadge({ type }: { type: 'intraday' | 'scalp' }) {
  if (type === 'scalp') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan font-semibold text-[10px] whitespace-nowrap flex-shrink-0">
        <Zap className="w-2.5 h-2.5" /> SCALP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber font-semibold text-[10px] whitespace-nowrap flex-shrink-0">
      <BarChart3 className="w-2.5 h-2.5" /> INTRADAY
    </span>
  );
}

function DirectionBadge({ direction }: { direction: 'LONG' | 'SHORT' }) {
  if (direction === 'LONG') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green font-semibold">
        <TrendingUp className="w-3 h-3" /> LONG
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-red/10 text-accent-red font-semibold">
      <TrendingDown className="w-3 h-3" /> SHORT
    </span>
  );
}

function StatusBadge({ status }: { status: SignalStatus }) {
  switch (status) {
    case 'tp1_hit':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green font-semibold whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" /> TP1 Hit
        </span>
      );
    case 'tp2_hit':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green font-semibold whitespace-nowrap">
          <Target className="w-3 h-3" /> TP2 Hit
        </span>
      );
    case 'sl_hit':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-red/15 text-accent-red font-semibold whitespace-nowrap">
          <XCircle className="w-3 h-3" /> SL Hit
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber font-semibold whitespace-nowrap">
          <Clock className="w-3 h-3 animate-pulse" /> In Progress
        </span>
      );
  }
}
