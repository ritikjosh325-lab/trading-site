export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

const BASE = 'https://api.binance.com/api/v3';
const FUTURES_BASE = 'https://fapi.binance.com/fapi/v1';

export async function fetchOpenInterest(symbol: string): Promise<number> {
  const url = `${FUTURES_BASE}/openInterest?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance OI ${res.status}`);
  const d = await res.json();
  return parseFloat(d.openInterest);
}

export async function fetchKlines(symbol: string, interval = '15m', limit = 100): Promise<Candle[]> {
  const url = `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

export async function fetchTicker(symbol: string): Promise<Ticker> {
  const url = `${BASE}/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker ${res.status}`);
  const d = await res.json();
  return {
    symbol: d.symbol,
    lastPrice: parseFloat(d.lastPrice),
    priceChangePercent: parseFloat(d.priceChangePercent),
    highPrice: parseFloat(d.highPrice),
    lowPrice: parseFloat(d.lowPrice),
    volume: parseFloat(d.volume),
    quoteVolume: parseFloat(d.quoteVolume),
  };
}

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  const url = `${BASE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance tickers ${res.status}`);
  const data = (await res.json()) as Record<string, string>[];
  return data.map((d) => ({
    symbol: d.symbol,
    lastPrice: parseFloat(d.lastPrice),
    priceChangePercent: parseFloat(d.priceChangePercent),
    highPrice: parseFloat(d.highPrice),
    lowPrice: parseFloat(d.lowPrice),
    volume: parseFloat(d.volume),
    quoteVolume: parseFloat(d.quoteVolume),
  }));
}
