import { useEffect, useState } from 'react';
import { settingsRepo } from '../data/settingsRepo';
import { useAppConfig } from '../app/AppConfigContext';

export interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { setChatDays, refreshAdapter } = useAppConfig();
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [chatDaysInput, setChatDaysInput] = useState('3');

  useEffect(() => {
    void (async () => {
      const [cfg, days] = await Promise.all([
        settingsRepo.getLLMConfig(),
        settingsRepo.get('chat_days'),
      ]);
      setProvider(cfg.provider ?? 'anthropic');
      setApiKey(cfg.apiKey ?? '');
      setModel(cfg.model ?? '');
      setBaseUrl(cfg.baseUrl ?? '');
      setChatDaysInput(days ?? '3');
    })();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function save() {
    const days = Math.max(1, Math.min(14, parseInt(chatDaysInput, 10) || 3));
    await setChatDays(days);

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      await settingsRepo.clearLLMConfig();
      await refreshAdapter();
      onClose();
      return;
    }

    const trimmedModel = model.trim();
    if (!trimmedModel) {
      alert('Please enter a model name.');
      return;
    }

    await settingsRepo.saveLLMConfig({
      provider,
      apiKey: trimmedKey,
      model: trimmedModel,
      baseUrl: baseUrl.trim(),
    });
    await refreshAdapter();
    onClose();
  }

  return (
    <div
      className="modal-overlay visible"
      id="settingsModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Settings</div>
          </div>
          <button className="modal-close" id="settingsCloseBtn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body settings-body">
          <label className="settings-label">Provider</label>
          <select
            id="llmProviderSelect"
            className="settings-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI-compatible</option>
          </select>

          <label className="settings-label">API Key</label>
          <input
            type="password"
            id="apiKeyInput"
            className="settings-input"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />

          <label className="settings-label">Model</label>
          <input
            type="text"
            id="llmModelInput"
            className="settings-input"
            placeholder="claude-haiku-4-5-20251001"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />

          {provider === 'openai' && (
            <div id="baseUrlGroup">
              <label className="settings-label">Base URL</label>
              <input
                type="text"
                id="llmBaseUrlInput"
                className="settings-input"
                placeholder="https://api.openai.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="settings-hint">For Ollama use http://localhost:11434</p>
            </div>
          )}

          <label className="settings-label">Days to show in chat</label>
          <input
            type="number"
            id="chatDaysInput"
            className="settings-input"
            min={1}
            max={14}
            placeholder="3"
            value={chatDaysInput}
            onChange={(e) => setChatDaysInput(e.target.value)}
          />

          <p className="settings-hint">
            Used for AI log formatting. Stored locally, never sent anywhere else.
          </p>
          <button id="saveSettingsBtn" className="settings-save-btn" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
