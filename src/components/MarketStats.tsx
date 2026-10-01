import { TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import type { Ticker } from '@/lib/binance';
import { fmtPrice, fmtCompact, fmtPct } from '@/lib/format';

interface Props {
  ticker: Ticker | null;
}

export function MarketStats({ ticker }: Props) {
  if (!ticker) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel p-4 animate-pulse">
            <div className="h-3 w-16 bg-bg-raised rounded mb-2" />
            <div className="h-5 w-24 bg-bg-raised rounded" />
          </div>
        ))}
      </div>
    );
  }

  const isUp = ticker.priceChangePercent >= 0;
  const stats = [
    {
      icon: DollarSign,
      label: 'Last Price',
      value: `$${fmtPrice(ticker.lastPrice)}`,
      sub: `${fmtPct(ticker.priceChangePercent)}`,
      subColor: isUp ? 'text-accent-green' : 'text-accent-red',
      iconColor: 'text-accent-blue',
    },
    {
      icon: TrendingUp,
      label: '24h High',
      value: `$${fmtPrice(ticker.highPrice)}`,
      sub: 'High',
      subColor: 'text-gray-600',
      iconColor: 'text-accent-green',
    },
    {
      icon: TrendingDown,
      label: '24h Low',
      value: `$${fmtPrice(ticker.lowPrice)}`,
      sub: 'Low',
      subColor: 'text-gray-600',
      iconColor: 'text-accent-red',
    },
    {
      icon: BarChart3,
      label: '24h Volume',
      value: `$${fmtCompact(ticker.quoteVolume)}`,
      sub: `${fmtCompact(ticker.volume)} ${ticker.symbol.replace('USDT', '')}`,
      subColor: 'text-gray-600',
      iconColor: 'text-accent-cyan',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <Icon className={`w-3.5 h-3.5 ${s.iconColor}`} />
            </div>
            <div className="font-mono font-semibold text-gray-200 text-sm">{s.value}</div>
            <div className={`text-xs font-mono mt-0.5 ${s.subColor}`}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
