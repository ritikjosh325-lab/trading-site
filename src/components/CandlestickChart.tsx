import { useMemo } from 'react';
import type { Candle } from '@/lib/binance';
import { ema } from '@/lib/indicators';

interface Props {
  candles: Candle[];
  height?: number;
}

export function CandlestickChart({ candles, height = 380 }: Props) {
  const padding = { top: 16, right: 64, bottom: 24, left: 8 };
  const width = 1000;

  const { paths, scales } = useMemo(() => {
    if (candles.length < 2) return { paths: null, scales: null };
    const n = candles.length;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    let max = Math.max(...highs);
    let min = Math.min(...lows);
    const range = max - min;
    max += range * 0.05;
    min -= range * 0.05;

    const x = (i: number) => padding.left + (i / (n - 1)) * chartW;
    const y = (price: number) => padding.top + (1 - (price - min) / (max - min)) * chartH;

    const candleW = Math.max(2, (chartW / n) * 0.65);

    const ema9Arr = ema(candles.map((c) => c.close), 9);
    const ema21Arr = ema(candles.map((c) => c.close), 21);

    let ema9Path = '';
    let ema21Path = '';
    for (let i = 0; i < n; i++) {
      const px = x(i);
      const py9 = y(ema9Arr[i]);
      const py21 = y(ema21Arr[i]);
      ema9Path += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py9.toFixed(1)} `;
      ema21Path += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py21.toFixed(1)} `;
    }

    const lastPrice = candles[n - 1].close;
    const prevPrice = candles[n - 2].close;
    const priceUp = lastPrice >= prevPrice;

    const gridLines: { y: number; price: number }[] = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const price = min + ((max - min) * i) / steps;
      gridLines.push({ y: y(price), price });
    }

    return {
      paths: { ema9Path, ema21Path, candleW, x, y, priceUp, lastPrice, gridLines, n },
      scales: { min, max },
    };
  }, [candles, height]);

  if (!paths) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height }}>
        Loading chart…
      </div>
    );
  }

  const { ema9Path, ema21Path, candleW, x, y, priceUp, lastPrice, gridLines, n } = paths;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ema9Glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={g.y}
            x2={width - padding.right}
            y2={g.y}
            stroke="#1a2332"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <text x={width - padding.right + 6} y={g.y + 3} fill="#4a5568" fontSize="10" fontFamily="monospace">
            {g.price >= 1000 ? g.price.toFixed(0) : g.price.toFixed(2)}
          </text>
        </g>
      ))}

      {candles.map((c, i) => {
        const cx = x(i);
        const isUp = c.close >= c.open;
        const color = isUp ? '#10b981' : '#ef4444';
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBottom - bodyTop);
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.high)} x2={cx} y2={y(c.low)} stroke={color} strokeWidth="1" opacity="0.8" />
            <rect
              x={cx - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={bodyH}
              fill={color}
              opacity={i === n - 1 ? 1 : 0.85}
              rx="0.5"
            />
          </g>
        );
      })}

      <path d={ema9Path} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.9" />
      <path d={ema21Path} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.9" />

      <line
        x1={padding.left}
        y1={y(lastPrice)}
        x2={width - padding.right}
        y2={y(lastPrice)}
        stroke={priceUp ? '#10b981' : '#ef4444'}
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.6"
      />
      <rect
        x={width - padding.right}
        y={y(lastPrice) - 9}
        width={padding.right}
        height="18"
        fill={priceUp ? '#10b981' : '#ef4444'}
        rx="2"
      />
      <text
        x={width - padding.right + 4}
        y={y(lastPrice) + 3}
        fill="#0a0e17"
        fontSize="10"
        fontWeight="700"
        fontFamily="monospace"
      >
        {lastPrice >= 1000 ? lastPrice.toFixed(0) : lastPrice.toFixed(2)}
      </text>
    </svg>
  );
}
