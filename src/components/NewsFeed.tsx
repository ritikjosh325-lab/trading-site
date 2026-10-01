import { Newspaper, ExternalLink } from 'lucide-react';
import type { NewsItem } from '@/lib/news';
import { timeAgo } from '@/lib/format';

interface Props {
  news: NewsItem[];
}

export function NewsFeed({ news }: Props) {
  return (
    <div className="panel p-5 flex flex-col" style={{ maxHeight: '600px' }}>
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-4 h-4 text-accent-cyan" />
        <h3 className="text-sm font-semibold text-gray-200">Crypto News Feed</h3>
        <span className="ml-auto text-xs text-gray-600">{news.length} headlines</span>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1 -mr-1">
        {news.length === 0 && (
          <div className="text-gray-500 text-sm py-8 text-center">Fetching latest crypto news…</div>
        )}
        {news.map((item, i) => {
          const color = item.sentiment === 'bullish' ? 'text-accent-green bg-accent-green/10' : item.sentiment === 'bearish' ? 'text-accent-red bg-accent-red/10' : 'text-accent-amber bg-accent-amber/10';
          const dot = item.sentiment === 'bullish' ? 'bg-accent-green' : item.sentiment === 'bearish' ? 'bg-accent-red' : 'bg-accent-amber';
          return (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg bg-bg-raised hover:bg-bg-hover border border-transparent hover:border-bg-border transition-all group"
            >
              <div className="flex items-start gap-2.5">
                <div className={`mt-1.5 w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 leading-snug group-hover:text-white transition-colors line-clamp-2">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-600">{item.source}</span>
                    <span className="text-xs text-gray-700">·</span>
                    <span className="text-xs text-gray-600">{timeAgo(item.publishedAt)}</span>
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
                      {item.sentiment}
                    </span>
                    <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-gray-400 transition-colors" />
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
