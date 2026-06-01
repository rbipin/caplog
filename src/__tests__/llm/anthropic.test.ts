import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAdapter } from '../../llm/anthropic.js';

describe('AnthropicAdapter', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('happy path: returns trimmed content[0].text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: '  result  ' }] }),
    }));
    const adapter = new AnthropicAdapter('key', 'model');
    expect(await adapter.complete('sys', 'user')).toBe('result');
  });

  it('HTTP error response throws with status code in message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }));
    const adapter = new AnthropicAdapter('key', 'model');
    await expect(adapter.complete('sys', 'user')).rejects.toThrow('401');
  });

  it('response body missing content array throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    const adapter = new AnthropicAdapter('key', 'model');
    await expect(adapter.complete('sys', 'user')).rejects.toThrow();
  });
});
