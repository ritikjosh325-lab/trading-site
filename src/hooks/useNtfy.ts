import { useCallback, useEffect, useRef, useState } from 'react';

export interface NtfyConfig {
  topic: string;
  intradayEnabled: boolean;
  scalpEnabled: boolean;
}

const STORAGE_KEY = 'cryptoflow_ntfy';
const COOLDOWN_MS = 5 * 60 * 1000;

const DEFAULT_CONFIG: NtfyConfig = {
  topic: 'hrithik-trading-signals-99',
  intradayEnabled: true,
  scalpEnabled: true,
};

function loadConfig(): NtfyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    // ignore parse errors
  }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg: NtfyConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore quota errors
  }
}

async function sendNtfy(topic: string, title: string, message: string, tags: string): Promise<boolean> {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Tags': tags,
        'Priority': '5',
      },
      body: message,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useNtfy() {
  const [config, setConfig] = useState<NtfyConfig>(loadConfig);
  const [modalOpen, setModalOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const cooldownRef = useRef<Record<string, number>>({});

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const sendTest = useCallback(async () => {
    if (!config.topic) return;
    setTestStatus('sending');
    const ok = await sendNtfy(
      config.topic,
      'CryptoFlow AI Test',
      'Push notifications are working correctly. You will receive automated signal alerts here.',
      'white_check_mark'
    );
    setTestStatus(ok ? 'success' : 'error');
    setTimeout(() => setTestStatus('idle'), 3000);
  }, [config]);

  const sendSignalAlert = useCallback(
    async (params: {
      type: 'intraday' | 'scalp';
      action: string;
      symbol: string;
      entryLow: number;
      entryHigh: number;
      stopLoss: number;
      tp1: number;
      tp2: number;
      confluenceScore?: number;
      confluenceTotal?: number;
    }) => {
      if (!config.topic) return;

      const enabled = params.type === 'intraday' ? config.intradayEnabled : config.scalpEnabled;
      if (!enabled) return;

      const now = Date.now();
      const cooldownKey = `${params.symbol}_${params.type}`;
      const last = cooldownRef.current[cooldownKey] ?? 0;
      if (now - last < COOLDOWN_MS) return;
      cooldownRef.current[cooldownKey] = now;

      const isBuy = params.action.includes('BUY');
      const actionLabel = isBuy ? 'BUY' : 'SELL';
      const asset = params.symbol.replace('USDT', '/USDT');
      const typeLabel = params.type === 'scalp' ? 'SCALP' : 'INTRADAY';
      const emoji = isBuy ? 'rocket' : 'chart_with_downwards_trend';

      const title = `${typeLabel} ALERT: ${actionLabel} ${asset}`;
      const body =
        `Asset: ${asset}\n` +
        `Action: ${actionLabel}\n` +
        `Entry Zone: $${params.entryLow.toFixed(2)} – $${params.entryHigh.toFixed(2)}\n` +
        `Stop Loss: $${params.stopLoss.toFixed(2)}\n` +
        `Target 1: $${params.tp1.toFixed(2)}\n` +
        `Target 2: $${params.tp2.toFixed(2)}` +
        (params.confluenceScore != null && params.confluenceTotal != null
          ? `\nConfluence: ${params.confluenceScore}/${params.confluenceTotal} Verified`
          : '') +
        `\nTime: ${new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' })}`;

      await sendNtfy(config.topic, title, body, emoji);
    },
    [config]
  );

  return {
    config,
    setConfig,
    modalOpen,
    setModalOpen,
    testStatus,
    sendTest,
    sendSignalAlert,
    isConfigured: !!config.topic,
  };
}
