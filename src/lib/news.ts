export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

const BULLISH = [
  'surge', 'soar', 'rally', 'bullish', 'breakout', 'all-time high', 'ath', 'gain',
  'soars', 'pump', 'adoption', 'approve', 'etf approved', 'institutional',
  'upgrade', 'buy', 'long', 'support', 'recovery', 'rebound', 'jump', 'climb',
  'outperform', 'positive', 'optimism', 'confidence', 'accumulate', 'inflow',
  'green', 'moon', 'rocket', 'partnership', 'launch', 'bull', 'uptrend',
];
const BEARISH = [
  'crash', 'plunge', 'bearish', 'dump', 'sell-off', 'selloff', 'reject', 'resistance',
  'breakdown', 'liquidation', 'ban', 'hack', 'exploit', 'fraud', 'lawsuit',
  'sec', 'regulate', 'crackdown', 'fear', 'panic', 'decline', 'drop', 'fall',
  'sell', 'short', 'bear', 'downtrend', 'outflow', 'red', 'correction',
  'warning', 'risk', 'concern', 'fud', 'collapse', 'slump', 'tumble',
];
const NEUTRAL_HINTS = [
  'update', 'report', 'analysis', 'weekly', 'monthly', 'summary', 'overview',
  'review', 'outlook', 'watch', 'monitor', 'consolidate', 'range', 'sideways',
];

function scoreText(text: string): number {
  const lower = text.toLowerCase();
  let bull = 0;
  let bear = 0;
  for (const w of BULLISH) if (lower.includes(w)) bull++;
  for (const w of BEARISH) if (lower.includes(w)) bear++;
  for (const w of NEUTRAL_HINTS) if (lower.includes(w)) bull -= 0.3;
  const total = bull + bear;
  if (total === 0) return 0;
  return ((bull - bear) / Math.max(total, 1)) * 100;
}

function classify(score: number): 'bullish' | 'bearish' | 'neutral' {
  if (score > 18) return 'bullish';
  if (score < -18) return 'bearish';
  return 'neutral';
}

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const FEEDS = [
  'https://cointelegraph.com/rss',
  'https://cryptonews.com/news/feed',
  'https://bitcoinist.com/feed/',
  'https://news.bitcoin.com/feed/',
  'https://coinjournal.net/feed/',
  'https://www.newsbtc.com/feed/',
];

interface RawItem {
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  source?: string;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(RSS2JSON + encodeURIComponent(feed));
      if (!res.ok) throw new Error('feed fail');
      const data = await res.json();
      if (!data?.items) throw new Error('no items');
      return (data.items as RawItem[]).slice(0, 8).map((item) => {
        const score = scoreText(item.title);
        return {
          title: item.title,
          url: item.link,
          source: item.source || item.author || feedName(feed),
          publishedAt: new Date(item.pubDate).getTime(),
          sentiment: classify(score),
          score,
        } as NewsItem;
      });
    })
  );
  const all: NewsItem[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  all.sort((a, b) => b.publishedAt - a.publishedAt);
  return all.slice(0, 30);
}

function feedName(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.replace('www.', '').replace(/^www\./, '');
  } catch {
    return 'Crypto News';
  }
}

export interface SentimentSummary {
  score: number;
  label: 'Bullish' | 'Neutral' | 'Bearish';
  bullish: number;
  bearish: number;
  neutral: number;
  total: number;
}

const HIGH_IMPACT_KEYWORDS = [
  'cpi', 'fomc', 'fed', 'rate decision', 'interest rate', 'rate cut', 'rate hike',
  'powell', 'yellen', 'ecb', 'boe', 'boj', 'nonfarm', 'non-farm', 'unemployment',
  'gdp', 'hack', 'exploit', 'sec', 'lawsuit', 'ban', 'crackdown', 'executive order',
  'treasury', 'sanction', 'binance', 'ftx', 'sec sues', 'regulation',
];

export interface HighImpactEvent {
  title: string;
  source: string;
  publishedAt: number;
  url: string;
}

export function detectHighImpactEvents(items: NewsItem[], windowMs = 15 * 60 * 1000): HighImpactEvent[] {
  const now = Date.now();
  return items
    .filter((item) => now - item.publishedAt <= windowMs)
    .filter((item) => {
      const lower = item.title.toLowerCase();
      return HIGH_IMPACT_KEYWORDS.some((kw) => lower.includes(kw));
    })
    .map((item) => ({
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      url: item.url,
    }));
}

export function summarizeSentiment(items: NewsItem[]): SentimentSummary {
  if (items.length === 0) {
    return { score: 0, label: 'Neutral', bullish: 0, bearish: 0, neutral: 0, total: 0 };
  }
  const bullish = items.filter((i) => i.sentiment === 'bullish').length;
  const bearish = items.filter((i) => i.sentiment === 'bearish').length;
  const neutral = items.filter((i) => i.sentiment === 'neutral').length;
  const avg = items.reduce((s, i) => s + i.score, 0) / items.length;
  const label = avg > 18 ? 'Bullish' : avg < -18 ? 'Bearish' : 'Neutral';
  return { score: avg, label, bullish, bearish, neutral, total: items.length };
}
