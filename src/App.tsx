import { useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { ChartHeader } from '@/components/ChartHeader';
import { CandlestickChart } from '@/components/CandlestickChart';
import { RsiChart } from '@/components/RsiChart';
import { SignalCard } from '@/components/SignalCard';
import { ScalpSignalCard } from '@/components/ScalpSignalCard';
import { SentimentPanel } from '@/components/SentimentPanel';
import { NewsFeed } from '@/components/NewsFeed';
import { MarketStats } from '@/components/MarketStats';
import { SignalHistory } from '@/components/SignalHistory';
import { TelegramModal } from '@/components/TelegramModal';
import { NtfyModal } from '@/components/NtfyModal';
import { useMarketData } from '@/hooks/useMarketData';
import { useScalpData } from '@/hooks/useScalpData';
import { useOrderFlow } from '@/hooks/useOrderFlow';
import { useSignalAlert } from '@/hooks/useSignalAlert';
import { useTelegram } from '@/hooks/useTelegram';
import { useNtfy } from '@/hooks/useNtfy';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import type { SignalMode } from '@/lib/signal';
import type { ScalpTimeframe, ScalpMode } from '@/lib/scalp';
import { AlertCircle, Zap, Activity } from 'lucide-react';

type DashboardTab = 'intraday' | 'scalp';

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [mode, setMode] = useState<SignalMode>('normal');
  const [tab, setTab] = useState<DashboardTab>('intraday');
  const [scalpTf, setScalpTf] = useState<ScalpTimeframe>('1m');
  const [scalpMode, setScalpMode] = useState<ScalpMode>('normal');
  const interval = '15m';

  const isScalp = tab === 'scalp';
  const orderFlow = useOrderFlow(symbol);
  const intraday = useMarketData(symbol, interval, mode, orderFlow.imbalance);
  const scalp = useScalpData(symbol, scalpTf, scalpMode, orderFlow.imbalance);
  const telegram = useTelegram();
  const ntfy = useNtfy();
  const history = useSignalHistory();

  const candles = isScalp ? scalp.candles : intraday.candles;

  const activeSignal = isScalp ? scalp.signal : intraday.signal;
  const pulse = useSignalAlert(activeSignal);

  // Track which signals have already been sent to avoid duplicates
  const lastScalpKeyRef = useRef<Record<string, string>>({});
  const lastIntradayKeyRef = useRef<Record<string, string>>({});

  // --- Automated alerts + history logging on new actionable scalp signal ---
  const scalpSignal = scalp.signal;
  if (scalpSignal && isScalp) {
    const isActionable = scalpSignal.action === 'QUICK BUY' || scalpSignal.action === 'QUICK SELL';
    const signalKey = `${symbol}_${scalpSignal.action}_${scalpSignal.candleCloseTime}`;
    if (isActionable && signalKey !== lastScalpKeyRef.current[symbol]) {
      lastScalpKeyRef.current[symbol] = signalKey;
      const direction = scalpSignal.action === 'QUICK BUY' ? 'LONG' : 'SHORT';
      history.logSignal({
        symbol,
        type: 'scalp',
        direction,
        entry: scalpSignal.entry,
        entryLow: scalpSignal.entryLow,
        entryHigh: scalpSignal.entryHigh,
        tp1: scalpSignal.tp1,
        tp2: scalpSignal.tp2,
        stopLoss: scalpSignal.stopLoss,
        candleCloseTime: scalpSignal.candleCloseTime,
      });
      if (telegram.isConfigured) {
        telegram.sendSignalAlert({
          action: scalpSignal.action,
          symbol,
          entryLow: scalpSignal.entryLow,
          entryHigh: scalpSignal.entryHigh,
          stopLoss: scalpSignal.stopLoss,
          tp1: scalpSignal.tp1,
          tp2: scalpSignal.tp2,
          confluenceScore: scalpSignal.confluenceScore,
          confluenceTotal: scalpSignal.checks.length,
          rrTp1: scalpSignal.rrTp1,
          rrTp2: scalpSignal.rrTp2,
        });
      }
      ntfy.sendSignalAlert({
        type: 'scalp',
        action: scalpSignal.action,
        symbol,
        entryLow: scalpSignal.entryLow,
        entryHigh: scalpSignal.entryHigh,
        stopLoss: scalpSignal.stopLoss,
        tp1: scalpSignal.tp1,
        tp2: scalpSignal.tp2,
        confluenceScore: scalpSignal.confluenceScore,
        confluenceTotal: scalpSignal.checks.length,
      });
    }
  }

  // --- Automated alerts + history logging on new actionable intraday signal ---
  const intradaySignal = intraday.signal;
  if (intradaySignal && !isScalp) {
    const isActionable = intradaySignal.action === 'BUY' || intradaySignal.action === 'SELL';
    const signalKey = `${symbol}_${intradaySignal.action}_${intradaySignal.candleCloseTime}`;
    if (isActionable && signalKey !== lastIntradayKeyRef.current[symbol]) {
      lastIntradayKeyRef.current[symbol] = signalKey;
      const direction = intradaySignal.action === 'BUY' ? 'LONG' : 'SHORT';
      history.logSignal({
        symbol,
        type: 'intraday',
        direction,
        entry: intradaySignal.entry,
        entryLow: intradaySignal.entryLow,
        entryHigh: intradaySignal.entryHigh,
        tp1: intradaySignal.tp1,
        tp2: intradaySignal.tp2,
        stopLoss: intradaySignal.stopLoss,
        candleCloseTime: intradaySignal.candleCloseTime,
      });
      ntfy.sendSignalAlert({
        type: 'intraday',
        action: intradaySignal.action,
        symbol,
        entryLow: intradaySignal.entryLow,
        entryHigh: intradaySignal.entryHigh,
        stopLoss: intradaySignal.stopLoss,
        tp1: intradaySignal.tp1,
        tp2: intradaySignal.tp2,
        confluenceScore: intradaySignal.confluenceScore,
        confluenceTotal: intradaySignal.checks.length,
      });
    }
  }

  // --- Live outcome tracking: update open signals with live trade prices ---
  const livePrice = orderFlow.lastPrice;
  if (livePrice != null) {
    history.updateOutcomes({ [symbol]: livePrice });
  }

  const ticker = isScalp ? scalp.ticker : intraday.ticker;
  const loading = isScalp ? scalp.loading : intraday.loading;
  const error = isScalp ? scalp.error : intraday.error;
  const paused = isScalp ? scalp.paused : intraday.paused;
  const togglePause = isScalp ? scalp.togglePause : intraday.togglePause;
  const lastUpdate = isScalp ? scalp.lastUpdate : intraday.lastUpdate;
  const activeInterval = isScalp ? scalpTf : interval;
  const news = intraday.news;
  const sentiment = intraday.sentiment;

  return (
    <div className="min-h-screen grid-bg">
      <Header
        symbol={symbol}
        onSymbolChange={setSymbol}
        onOpenTelegram={() => telegram.setModalOpen(true)}
        telegramActive={telegram.isConfigured}
        onOpenNtfy={() => ntfy.setModalOpen(true)}
        ntfyActive={ntfy.isConfigured && (ntfy.config.intradayEnabled || ntfy.config.scalpEnabled)}
      />

      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Unable to load market data: {error}. Retrying automatically…</span>
          </div>
        )}

        <MarketStats ticker={ticker} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div className="panel p-5">
              <ChartHeader
                symbol={symbol}
                interval={activeInterval}
                paused={paused}
                onTogglePause={togglePause}
                lastUpdate={lastUpdate}
              />
              {loading && candles.length === 0 ? (
                <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height: 380 }}>
                  Loading candlestick data…
                </div>
              ) : (
                <CandlestickChart candles={candles} height={380} />
              )}

              <div className="mt-3 pt-3 border-t border-bg-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500 font-medium">
                    {isScalp ? 'RSI (7) · Scalp' : 'RSI (14)'}
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    {isScalp ? (
                      <>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent-cyan" />EMA 5</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent-amber" />EMA 13</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent-purple" />RSI 7</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent-blue" />EMA 9</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent-amber" />EMA 21</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-accent-purple" />RSI</span>
                      </>
                    )}
                  </div>
                </div>
                <RsiChart candles={candles} height={90} />
              </div>
            </div>

            <NewsFeed news={news} />
          </div>

          <div className="space-y-4">
            <div className="flex p-1 bg-bg-raised rounded-lg border border-bg-border">
              <button
                onClick={() => setTab('intraday')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                  tab === 'intraday'
                    ? 'bg-accent-blue text-white shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Intraday
              </button>
              <button
                onClick={() => setTab('scalp')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                  tab === 'scalp'
                    ? 'bg-accent-cyan text-bg-base shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Scalp
              </button>
            </div>

            {isScalp ? (
              <ScalpSignalCard
                signal={scalp.signal}
                symbol={symbol}
                timeframe={scalpTf}
                onTimeframeChange={setScalpTf}
                mode={scalpMode}
                onModeChange={setScalpMode}
                orderBookImbalance={orderFlow.imbalance}
                wsConnected={orderFlow.connected}
                pulse={isScalp && pulse}
              />
            ) : (
              <SignalCard
                signal={intraday.signal}
                symbol={symbol}
                mode={mode}
                onModeChange={setMode}
                orderBookImbalance={orderFlow.imbalance}
                wsConnected={orderFlow.connected}
                pulse={!isScalp && pulse}
              />
            )}
            <SentimentPanel sentiment={sentiment} />
          </div>
        </div>

        <SignalHistory records={history.records} stats={history.stats} />

        <footer className="pt-4 pb-6 text-center">
          <p className="text-xs text-gray-600">
            CryptoFlow AI · Educational tool only — not financial advice. Data via Binance public API & public RSS feeds.
          </p>
        </footer>
      </main>

      <TelegramModal
        open={telegram.modalOpen}
        onClose={() => telegram.setModalOpen(false)}
        config={telegram.config}
        onSave={telegram.setConfig}
        onTest={telegram.sendTest}
        testStatus={telegram.testStatus}
        isConfigured={telegram.isConfigured}
      />

      <NtfyModal
        open={ntfy.modalOpen}
        onClose={() => ntfy.setModalOpen(false)}
        config={ntfy.config}
        onSave={ntfy.setConfig}
        onTest={ntfy.sendTest}
        testStatus={ntfy.testStatus}
        isConfigured={ntfy.isConfigured}
      />
    </div>
  );
}

export default App;
