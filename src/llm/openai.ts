import { LLMAdapter } from './adapter.js';

export class OpenAIAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  async complete(system: string, user: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI-compatible API error ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from API');
    return (text as string).trim();
  }
}
