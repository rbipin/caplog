import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIAdapter } from '../../llm/openai.js';

describe('OpenAIAdapter', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('happy path: returns trimmed choices[0].message.content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '  result  ' } }] }),
    }));
    const adapter = new OpenAIAdapter('key', 'https://api.example.com', 'model');
    expect(await adapter.complete('sys', 'user')).toBe('result');
  });

  it('HTTP error response throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    const adapter = new OpenAIAdapter('key', 'https://api.example.com', 'model');
    await expect(adapter.complete('sys', 'user')).rejects.toThrow();
  });

  it('baseUrl trailing slash is normalised before appending /v1/chat/completions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'r' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new OpenAIAdapter('key', 'https://api.example.com/', 'model');
    await adapter.complete('sys', 'user');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('https://api.example.com/v1/chat/completions');
  });

  it('response body missing choices throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    const adapter = new OpenAIAdapter('key', 'https://api.example.com', 'model');
    await expect(adapter.complete('sys', 'user')).rejects.toThrow();
  });
});
