import { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Loader2, Bell } from 'lucide-react';
import type { TelegramConfig } from '@/hooks/useTelegram';

interface Props {
  open: boolean;
  onClose: () => void;
  config: TelegramConfig;
  onSave: (cfg: TelegramConfig) => void;
  onTest: () => void;
  testStatus: 'idle' | 'sending' | 'success' | 'error';
  isConfigured: boolean;
}

export function TelegramModal({ open, onClose, config, onSave, onTest, testStatus, isConfigured }: Props) {
  const [botToken, setBotToken] = useState(config.botToken);
  const [chatId, setChatId] = useState(config.chatId);

  if (!open) return null;

  const handleSave = () => {
    onSave({ botToken: botToken.trim(), chatId: chatId.trim() });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md panel p-5 space-y-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/15 flex items-center justify-center">
              <Bell className="w-4 h-4 text-accent-blue" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Telegram Alerts</h3>
              <p className="text-xs text-gray-500">Get push notifications for verified signals</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isConfigured && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent-green/10 border border-accent-green/20 rounded-lg text-xs text-accent-green">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Notifications active — alerts will be sent automatically
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">Bot Token</label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              className="w-full px-3 py-2 bg-bg-raised border border-bg-border rounded-lg text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1">Get this from @BotFather in Telegram</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789"
              className="w-full px-3 py-2 bg-bg-raised border border-bg-border rounded-lg text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1">Get this from @userinfobot in Telegram</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={onTest}
            disabled={!botToken.trim() || !chatId.trim() || testStatus === 'sending'}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-raised border border-bg-border rounded-lg text-sm font-medium text-gray-300 hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testStatus === 'sending' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : testStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-accent-green" />
            ) : testStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 text-accent-red" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {testStatus === 'sending' ? 'Sending…' : testStatus === 'success' ? 'Sent!' : testStatus === 'error' ? 'Failed' : 'Send Test'}
          </button>
        </div>

        {testStatus === 'error' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent-red/10 border border-accent-red/20 rounded-lg text-xs text-accent-red">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed to send. Check your Bot Token and Chat ID.
          </div>
        )}

        <div className="pt-2 border-t border-bg-border text-xs text-gray-600 space-y-1">
          <p>1. Open Telegram and message @BotFather</p>
          <p>2. Send /newbot and follow the prompts</p>
          <p>3. Copy the Bot Token and paste it above</p>
          <p>4. Message your bot, then visit @userinfobot to get your Chat ID</p>
          <p>5. Save and tap "Send Test" to verify</p>
        </div>
      </div>
    </div>
  );
}
