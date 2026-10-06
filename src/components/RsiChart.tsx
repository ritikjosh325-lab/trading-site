import { useMemo } from 'react';
import type { Candle } from '@/lib/binance';
import { rsi } from '@/lib/indicators';

interface Props {
  candles: Candle[];
  height?: number;
}

export function RsiChart({ candles, height = 90 }: Props) {
  const padding = { top: 8, right: 64, bottom: 8, left: 8 };
  const width = 1000;

  const safeCandles = Array.isArray(candles) ? candles : [];

  const data = useMemo(() => {
    if (safeCandles.length < 20) return null;
    const closes = safeCandles.map((c) => c.close);
    const rsiArr = rsi(closes, 14);
    const n = safeCandles.length;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const x = (i: number) => padding.left + (i / (n - 1)) * chartW;
    const y = (v: number) => padding.top + (1 - v / 100) * chartH;

    let path = '';
    let lastVal = 50;
    for (let i = 0; i < n; i++) {
      const v = rsiArr[i];
      if (isNaN(v)) continue;
      lastVal = v;
      const px = x(i);
      const py = y(v);
      path += `${path === '' ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)} `;
    }

    return { path, lastVal, x, y, n };
  }, [safeCandles, height]);

  if (!data) return <div className="flex items-center justify-center text-gray-500 text-xs" style={{ height }}>Loading RSI…</div>;

  const { path, lastVal, y } = data;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <rect x={padding.left} y={y(70)} width={width - padding.left - padding.right} height={y(30) - y(70)} fill="#1a2332" opacity="0.3" />

      <line x1={padding.left} y1={y(70)} x2={width - padding.right} y2={y(70)} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
      <line x1={padding.left} y1={y(50)} x2={width - padding.right} y2={y(50)} stroke="#4a5568" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.4" />
      <line x1={padding.left} y1={y(30)} x2={width - padding.right} y2={y(30)} stroke="#10b981" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />

      <text x={width - padding.right + 4} y={y(70) + 3} fill="#ef4444" fontSize="9" fontFamily="monospace" opacity="0.7">70</text>
      <text x={width - padding.right + 4} y={y(30) + 3} fill="#10b981" fontSize="9" fontFamily="monospace" opacity="0.7">30</text>

      <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.9" />

      <rect x={width - padding.right} y={y(lastVal) - 7} width={padding.right} height="14" fill="#8b5cf6" rx="2" />
      <text x={width - padding.right + 4} y={y(lastVal) + 3} fill="#0a0e17" fontSize="9" fontWeight="700" fontFamily="monospace">
        {lastVal.toFixed(0)}
      </text>
    </svg>
  );
}
