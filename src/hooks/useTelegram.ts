import { useCallback, useEffect, useRef, useState } from 'react';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

const STORAGE_KEY = 'cryptoflow_telegram';
const COOLDOWN_MS = 5 * 60 * 1000;

function loadConfig(): TelegramConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TelegramConfig;
  } catch {
    // ignore parse errors
  }
  return { botToken: '', chatId: '' };
}

function saveConfig(cfg: TelegramConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useTelegram() {
  const [config, setConfig] = useState<TelegramConfig>(loadConfig);
  const [modalOpen, setModalOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const cooldownRef = useRef<Record<string, number>>({});

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const sendTest = useCallback(async () => {
    if (!config.botToken || !config.chatId) return;
    setTestStatus('sending');
    const ok = await sendTelegramMessage(
      config.botToken,
      config.chatId,
      '✅ <b>CryptoFlow AI Test Alert</b>\n\nTelegram notifications are working correctly. You will receive automated scalp signal alerts here.'
    );
    setTestStatus(ok ? 'success' : 'error');
    setTimeout(() => setTestStatus('idle'), 3000);
  }, [config]);

  const sendSignalAlert = useCallback(
    async (params: {
      action: string;
      symbol: string;
      entryLow: number;
      entryHigh: number;
      stopLoss: number;
      tp1: number;
      tp2: number;
      confluenceScore: number;
      confluenceTotal: number;
      rrTp1: number;
      rrTp2: number;
    }) => {
      if (!config.botToken || !config.chatId) return;

      const now = Date.now();
      const last = cooldownRef.current[params.symbol] ?? 0;
      if (now - last < COOLDOWN_MS) return;
      cooldownRef.current[params.symbol] = now;

      const isBuy = params.action.includes('BUY');
      const emoji = isBuy ? '🚀' : '🔻';
      const actionLabel = isBuy ? 'BUY' : 'SELL';
      const asset = params.symbol.replace('USDT', '/USDT');
      const time = new Date().toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        month: 'short',
        day: 'numeric',
      });

      const msg =
        `${emoji} <b>AI SCALP ALERT: ${actionLabel}</b>\n\n` +
        `<b>Asset:</b> ${asset}\n` +
        `<b>Entry Zone:</b> $${params.entryLow.toFixed(2)} – $${params.entryHigh.toFixed(2)}\n` +
        `<b>Stop Loss (ATR):</b> $${params.stopLoss.toFixed(2)}\n` +
        `<b>Target 1:</b> $${params.tp1.toFixed(2)} | <b>Target 2:</b> $${params.tp2.toFixed(2)}\n` +
        `<b>Confluence:</b> ${params.confluenceScore}/${params.confluenceTotal} Verified\n` +
        `<b>Risk/Reward:</b> 1:${params.rrTp1.toFixed(1)} / 1:${params.rrTp2.toFixed(1)}\n` +
        `⏰ <b>Time:</b> ${time}`;

      await sendTelegramMessage(config.botToken, config.chatId, msg);
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
    isConfigured: !!config.botToken && !!config.chatId,
  };
}
