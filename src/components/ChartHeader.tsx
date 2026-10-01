import { Radio, Pause, Play } from 'lucide-react';

interface Props {
  symbol: string;
  interval: string;
  paused: boolean;
  onTogglePause: () => void;
  lastUpdate: number;
}

export function ChartHeader({ symbol, interval, paused, onTogglePause, lastUpdate }: Props) {
  const ago = Math.max(0, Math.floor((Date.now() - lastUpdate) / 1000));

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${paused ? 'bg-accent-amber' : 'bg-accent-green'} ${!paused ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold text-gray-200">{symbol}</span>
        </div>
        <span className="text-xs text-gray-600 px-2 py-0.5 bg-bg-raised rounded">{interval}</span>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Radio className="w-3 h-3" />
          <span>{paused ? 'Paused' : 'Live'}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {lastUpdate > 0 && (
          <span className="text-xs text-gray-600 font-mono">
            {paused ? '' : `Updated ${ago}s ago`}
          </span>
        )}
        <button
          onClick={onTogglePause}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-raised hover:bg-bg-hover rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors border border-bg-border"
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
}
