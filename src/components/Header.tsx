import { Bitcoin, Coins, Bell, Radio } from 'lucide-react';

interface Props {
  symbol: string;
  onSymbolChange: (s: string) => void;
  onOpenTelegram: () => void;
  telegramActive: boolean;
  onOpenNtfy: () => void;
  ntfyActive: boolean;
}

const SYMBOLS = [
  { value: 'BTCUSDT', label: 'BTC', Icon: Bitcoin },
  { value: 'ETHUSDT', label: 'ETH', Icon: Coins },
];

export function Header({ symbol, onSymbolChange, onOpenTelegram, telegramActive, onOpenNtfy, ntfyActive }: Props) {
  return (
    <header className="border-b border-bg-border bg-bg-panel/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center glow-blue">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12l4-4 4 4 4-4 4 4 2-2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 16l4-4 4 4 4-4 4 4 2-2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">CryptoFlow AI</h1>
            <p className="text-xs text-gray-500 leading-none mt-0.5">Intraday Trading Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-bg-raised rounded-xl p-1 border border-bg-border">
          {SYMBOLS.map(({ value, label, Icon }) => {
            const active = symbol === value;
            return (
              <button
                key={value}
                onClick={() => onSymbolChange(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}/USDT</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNtfy}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              ntfyActive
                ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/15'
                : 'bg-bg-raised border-bg-border text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Push</span>
            {ntfyActive && <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />}
          </button>

          <button
            onClick={onOpenTelegram}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              telegramActive
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green hover:bg-accent-green/15'
                : 'bg-bg-raised border-bg-border text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telegram</span>
            {telegramActive && <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />}
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
