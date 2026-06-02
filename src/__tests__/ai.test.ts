import { describe, it, expect, vi } from 'vitest';
import { formatLogEntry } from '../ai.js';
import type { LLMAdapter } from '../llm/adapter.js';

describe('formatLogEntry', () => {
  it('calls adapter.complete with the correct system prompt and raw text', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockResolvedValue('<ul><li>result</li></ul>') };
    await formatLogEntry('raw input', adapter);
    expect(adapter.complete).toHaveBeenCalledWith(
      expect.stringContaining('bullet'),
      'raw input'
    );
  });

  it('returns trimmed result from adapter', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockResolvedValue('  <ul><li>r</li></ul>  ') };
    expect(await formatLogEntry('x', adapter)).toBe('<ul><li>r</li></ul>');
  });

  it('propagates error thrown by adapter', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockRejectedValue(new Error('api down')) };
    await expect(formatLogEntry('x', adapter)).rejects.toThrow('api down');
  });
});
