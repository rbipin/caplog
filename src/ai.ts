import { LLMAdapter } from './llm/adapter.js';

const SYSTEM_PROMPT = 'Clean up and format the user\'s text into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points as HTML <ul><li>...</li></ul> with no preamble or explanation.';

export async function formatLogEntry(rawText: string, adapter: LLMAdapter): Promise<string> {
  const text = await adapter.complete(SYSTEM_PROMPT, rawText);
  return text.trim();
}
