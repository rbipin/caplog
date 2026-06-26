import { LLMAdapter } from './llm/adapter.js';

export const SYSTEM_PROMPT = [
  "You reformat the user's raw log text into clean, concise Markdown (bullet",
  'points; you may add one short bold lead-in line for long entries). Fix typos,',
  'capitalize properly, and remove filler. If the input is a long paragraph,',
  'summarize and rephrase it into well-structured bullets (nested where helpful) that',
  'remain readable and preserve all key context.',
  '',
  "Stay strictly grounded in the user's text. Never invent, assume, infer, or add",
  'any detail, fact, name, number, or conclusion that is not explicitly present in',
  'the input. Only rephrase, condense, and reorganize what is actually there. If',
  'something is vague, keep it vague rather than guessing.',
  '',
  'Return only Markdown — no preamble, explanation, code fences, or HTML.',
].join('\n');

/**
 * Normalize an LLM Markdown response: trim, strip any stray ``` code fences the
 * model may have wrapped the output in, and collapse leading/trailing blank lines.
 */
export function postProcessMarkdown(text: string): string {
  let out = text.trim();
  const fence = out.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  if (fence) out = fence[1];
  out = out
    .split('\n')
    .filter((line) => !/^```/.test(line.trim()))
    .join('\n');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export async function formatLogEntry(rawText: string, adapter: LLMAdapter): Promise<string> {
  const text = await adapter.complete(SYSTEM_PROMPT, rawText);
  return postProcessMarkdown(text);
}
