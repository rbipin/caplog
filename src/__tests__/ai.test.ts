import { describe, it, expect, vi } from 'vitest';
import { formatLogEntry, postProcessMarkdown, SYSTEM_PROMPT } from '../ai.js';
import type { LLMAdapter } from '../llm/adapter.js';

describe('SYSTEM_PROMPT', () => {
  it('asks for Markdown bullet points', () => {
    expect(SYSTEM_PROMPT).toMatch(/markdown/i);
    expect(SYSTEM_PROMPT).toMatch(/bullet/i);
  });

  it('contains the factual-grounding clause (must never be silently dropped)', () => {
    expect(SYSTEM_PROMPT).toMatch(/never invent, assume, infer, or add/i);
    expect(SYSTEM_PROMPT).toMatch(/strictly grounded/i);
  });

  it('forbids HTML output', () => {
    expect(SYSTEM_PROMPT).toMatch(/no .*HTML/i);
  });
});

describe('postProcessMarkdown', () => {
  it('trims surrounding whitespace', () => {
    expect(postProcessMarkdown('  - a  ')).toBe('- a');
  });

  it('strips a wrapping code fence', () => {
    expect(postProcessMarkdown('```markdown\n- a\n- b\n```')).toBe('- a\n- b');
  });

  it('removes stray fence lines', () => {
    expect(postProcessMarkdown('```\n- a\n```')).toBe('- a');
  });

  it('collapses excess blank lines', () => {
    expect(postProcessMarkdown('- a\n\n\n\n- b')).toBe('- a\n\n- b');
  });
});

describe('formatLogEntry', () => {
  it('calls adapter.complete with the Markdown system prompt and raw text', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockResolvedValue('- result') };
    await formatLogEntry('raw input', adapter);
    expect(adapter.complete).toHaveBeenCalledWith(SYSTEM_PROMPT, 'raw input');
  });

  it('post-processes the adapter result', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockResolvedValue('```\n- r\n```') };
    expect(await formatLogEntry('x', adapter)).toBe('- r');
  });

  it('propagates error thrown by adapter', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockRejectedValue(new Error('api down')) };
    await expect(formatLogEntry('x', adapter)).rejects.toThrow('api down');
  });
});
