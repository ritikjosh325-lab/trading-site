import { Smile, Meh, Frown } from 'lucide-react';
import type { SentimentSummary } from '@/lib/news';

interface Props {
  sentiment: SentimentSummary;
}

export function SentimentPanel({ sentiment }: Props) {
  const isBull = sentiment.label === 'Bullish';
  const isBear = sentiment.label === 'Bearish';
  const Icon = isBull ? Smile : isBear ? Frown : Meh;
  const color = isBull ? 'text-accent-green' : isBear ? 'text-accent-red' : 'text-accent-amber';
  const bg = isBull ? 'bg-accent-green/10' : isBear ? 'bg-accent-red/10' : 'bg-accent-amber/10';
  const barColor = isBull ? 'bg-accent-green' : isBear ? 'bg-accent-red' : 'bg-accent-amber';

  const total = Math.max(sentiment.total, 1);
  const bullPct = (sentiment.bullish / total) * 100;
  const bearPct = (sentiment.bearish / total) * 100;
  const neutPct = (sentiment.neutral / total) * 100;

  const meterVal = ((sentiment.score + 100) / 200) * 100;

  return (
    <div className="panel p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">News Sentiment</h3>

      <div className={`flex items-center gap-3 p-3 rounded-xl ${bg} mb-4`}>
        <Icon className={`w-8 h-8 ${color}`} />
        <div>
          <div className={`text-lg font-bold ${color}`}>{sentiment.label}</div>
          <div className="text-xs text-gray-500">
            Score: {sentiment.score >= 0 ? '+' : ''}{sentiment.score.toFixed(0)} · {sentiment.total} headlines
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
        <div className="relative h-2 bg-bg-raised rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-accent-red via-accent-amber to-accent-green rounded-full transition-all duration-700"
            style={{ width: '100%', opacity: 0.15 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-bg-base transition-all duration-700"
            style={{ left: `calc(${meterVal}% - 6px)`, background: isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b' }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <SentimentBar label="Bullish" count={sentiment.bullish} pct={bullPct} color="bg-accent-green" />
        <SentimentBar label="Neutral" count={sentiment.neutral} pct={neutPct} color="bg-accent-amber" />
        <SentimentBar label="Bearish" count={sentiment.bearish} pct={bearPct} color="bg-accent-red" />
      </div>
    </div>
  );
}

function SentimentBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500 font-mono">{count} · {pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-bg-raised rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
