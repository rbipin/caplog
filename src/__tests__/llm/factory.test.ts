import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAdapter } from '../../llm/anthropic.js';
import { OpenAIAdapter } from '../../llm/openai.js';

vi.mock('../../db.js', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
}));

import { getSetting } from '../../db.js';
import { getAdapter, runLLMMigration } from '../../llm/factory.js';

describe('getAdapter', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('no llm_provider setting → returns null', async () => {
    vi.mocked(getSetting).mockResolvedValue(null);
    expect(await getAdapter()).toBeNull();
  });

  it('llm_provider=anthropic, key present → returns AnthropicAdapter', async () => {
    vi.mocked(getSetting).mockImplementation(async (key) => {
      if (key === 'anthropic_api_key') return null;
      if (key === 'llm_provider') return 'anthropic';
      if (key === 'llm_api_key') return 'sk-test';
      if (key === 'llm_model') return 'claude-haiku-4-5-20251001';
      return null;
    });
    expect(await getAdapter()).toBeInstanceOf(AnthropicAdapter);
  });

  it('llm_provider=openai, key + baseUrl present → returns OpenAIAdapter', async () => {
    vi.mocked(getSetting).mockImplementation(async (key) => {
      if (key === 'anthropic_api_key') return null;
      if (key === 'llm_provider') return 'openai';
      if (key === 'llm_api_key') return 'sk-test';
      if (key === 'llm_model') return 'gpt-4o';
      if (key === 'llm_base_url') return 'https://api.openai.com';
      return null;
    });
    expect(await getAdapter()).toBeInstanceOf(OpenAIAdapter);
  });

  it('llm_provider=openai, no baseUrl → returns null', async () => {
    vi.mocked(getSetting).mockImplementation(async (key) => {
      if (key === 'anthropic_api_key') return null;
      if (key === 'llm_provider') return 'openai';
      if (key === 'llm_api_key') return 'sk-test';
      if (key === 'llm_model') return 'gpt-4o';
      if (key === 'llm_base_url') return null;
      return null;
    });
    expect(await getAdapter()).toBeNull();
  });

  it('legacy anthropic_api_key present, no llm_provider → migrates and returns AnthropicAdapter', async () => {
    // Before migration: old key present, no provider
    vi.mocked(getSetting).mockImplementation(async (key) => {
      if (key === 'anthropic_api_key') return 'legacy-key';
      if (key === 'llm_provider') return null;
      return null;
    });
    await runLLMMigration();

    // After migration: provider and api key are set
    vi.mocked(getSetting).mockImplementation(async (key) => {
      if (key === 'llm_provider') return 'anthropic';
      if (key === 'llm_api_key') return 'legacy-key';
      if (key === 'llm_model') return null;
      return null;
    });
    const result = await getAdapter();
    expect(result).toBeInstanceOf(AnthropicAdapter);
  });
});
