import { getSetting, setSetting, deleteSetting } from '../db.js';
import { LLMAdapter } from './adapter.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export async function runLLMMigration(): Promise<void> {
  const oldKey = await getSetting('anthropic_api_key');
  const provider = await getSetting('llm_provider');

  if (oldKey && !provider) {
    try {
      await setSetting('llm_provider', 'anthropic');
      await setSetting('llm_api_key', oldKey);
      await setSetting('llm_model', DEFAULT_ANTHROPIC_MODEL);
      await deleteSetting('anthropic_api_key');
    } catch {
      console.warn('LLM settings migration failed — will retry next launch');
    }
  }
}

export async function getAdapter(): Promise<LLMAdapter | null> {
  const provider = await getSetting('llm_provider');

  if (!provider) return null;

  const apiKey = await getSetting('llm_api_key');
  if (!apiKey) return null;

  const model = (await getSetting('llm_model')) || DEFAULT_ANTHROPIC_MODEL;

  if (provider === 'anthropic') {
    return new AnthropicAdapter(apiKey, model);
  }

  if (provider === 'openai') {
    const baseUrl = await getSetting('llm_base_url');
    if (!baseUrl) {
      console.warn('llm_provider=openai but llm_base_url is not set');
      return null;
    }
    return new OpenAIAdapter(apiKey, baseUrl, model);
  }

  return null;
}
