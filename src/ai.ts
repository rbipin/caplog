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
      messages: [{
        role: 'user',
        content: `Clean up and format this into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points as HTML <ul><li>...</li></ul> with no preamble or explanation:\n\n${rawText}`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  const data = await response.json();
  return (data.content[0].text as string).trim();
}
