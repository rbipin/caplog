import { LLMAdapter } from './adapter.js';

export class AnthropicAdapter implements LLMAdapter {
  constructor(private apiKey: string, private model: string) {}

  async complete(system: string, user: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) throw new Error('Empty response from Anthropic API');
    return (text as string).trim();
  }
}
