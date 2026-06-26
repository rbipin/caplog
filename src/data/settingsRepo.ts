import { getSetting, setSetting, deleteSetting } from '../db.js';

export interface LLMConfig {
  provider: string | null;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
}

const DEFAULT_CHAT_DAYS = 3;

/**
 * Repository for the `settings` key/value table. Only repos may import `db.ts`.
 */
export const settingsRepo = {
  get(key: string): Promise<string | null> {
    return getSetting(key);
  },

  set(key: string, value: string): Promise<void> {
    return setSetting(key, value);
  },

  remove(key: string): Promise<void> {
    return deleteSetting(key);
  },

  async getChatDays(): Promise<number> {
    const raw = await getSetting('chat_days');
    return parseInt(raw ?? String(DEFAULT_CHAT_DAYS)) || DEFAULT_CHAT_DAYS;
  },

  setChatDays(days: number): Promise<void> {
    const clamped = Math.max(1, Math.min(14, days || DEFAULT_CHAT_DAYS));
    return setSetting('chat_days', String(clamped));
  },

  async getLLMConfig(): Promise<LLMConfig> {
    const [provider, apiKey, model, baseUrl] = await Promise.all([
      getSetting('llm_provider'),
      getSetting('llm_api_key'),
      getSetting('llm_model'),
      getSetting('llm_base_url'),
    ]);
    return { provider, apiKey, model, baseUrl };
  },

  async saveLLMConfig(config: { provider: string; apiKey: string; model: string; baseUrl: string }): Promise<void> {
    await setSetting('llm_provider', config.provider);
    await setSetting('llm_api_key', config.apiKey);
    await setSetting('llm_model', config.model);
    await setSetting('llm_base_url', config.provider === 'openai' ? config.baseUrl : '');
  },

  async clearLLMConfig(): Promise<void> {
    await Promise.all([
      deleteSetting('llm_provider'),
      deleteSetting('llm_api_key'),
      deleteSetting('llm_model'),
      deleteSetting('llm_base_url'),
    ]);
  },
};
