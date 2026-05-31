export async function formatLogEntry(rawText: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'Clean up and format the user\'s text into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points as HTML <ul><li>...</li></ul> with no preamble or explanation.',
      messages: [{
        role: 'user',
        content: rawText,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from API');
  return (text as string).trim();
}
