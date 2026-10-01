import { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Loader2, Radio } from 'lucide-react';
import type { NtfyConfig } from '@/hooks/useNtfy';

interface Props {
  open: boolean;
  onClose: () => void;
  config: NtfyConfig;
  onSave: (cfg: NtfyConfig) => void;
  onTest: () => void;
  testStatus: 'idle' | 'sending' | 'success' | 'error';
  isConfigured: boolean;
}

export function NtfyModal({ open, onClose, config, onSave, onTest, testStatus, isConfigured }: Props) {
  const [topic, setTopic] = useState(config.topic);
  const [intradayEnabled, setIntradayEnabled] = useState(config.intradayEnabled);
  const [scalpEnabled, setScalpEnabled] = useState(config.scalpEnabled);

  if (!open) return null;

  const handleSave = () => {
    onSave({ topic: topic.trim(), intradayEnabled, scalpEnabled });
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
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/15 flex items-center justify-center">
              <Radio className="w-4 h-4 text-accent-cyan" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Push Notifications (ntfy.sh)</h3>
              <p className="text-xs text-gray-500">Free push alerts via ntfy.sh — no account needed</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isConfigured && (config.intradayEnabled || config.scalpEnabled) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent-green/10 border border-accent-green/20 rounded-lg text-xs text-accent-green">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Push notifications active
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="hrithik-trading-signals-99"
              className="w-full px-3 py-2 bg-bg-raised border border-bg-border rounded-lg text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1">
              Subscribe to this topic in the ntfy app (
              <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline">ntfy.sh</a>
              ) or web app to receive alerts
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <ToggleRow
            label="Intraday Signals Notification"
            description="Receive push alerts for 15m BUY/SELL signals"
            enabled={intradayEnabled}
            onToggle={() => setIntradayEnabled((v) => !v)}
          />
          <ToggleRow
            label="Scalping Signals Notification"
            description="Receive push alerts for scalp QUICK BUY/SELL signals"
            enabled={scalpEnabled}
            onToggle={() => setScalpEnabled((v) => !v)}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-cyan text-bg-base rounded-lg text-sm font-semibold hover:bg-accent-cyan/90 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={onTest}
            disabled={!topic.trim() || testStatus === 'sending'}
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
            Failed to send. Check your topic name.
          </div>
        )}

        <div className="pt-2 border-t border-bg-border text-xs text-gray-600 space-y-1">
          <p>1. Install the ntfy app on your phone (iOS/Android)</p>
          <p>2. Open the app and tap the + button to subscribe</p>
          <p>3. Enter the topic name above (or keep the default)</p>
          <p>4. Save and tap "Send Test" to verify</p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, enabled, onToggle }: { label: string; description: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-bg-raised rounded-lg border border-bg-border">
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-accent-cyan' : 'bg-bg-border'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}
