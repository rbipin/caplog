export type ParsedCommand =
  | { type: 'log'; text: string }
  | { type: 'todo'; text: string; deadline: string | null }
  | { type: 'important'; text: string }
  | { type: 'done'; task: string }
  | { type: 'empty' }

export function parseCommand(input: string): ParsedCommand {
  const value = input.trim();
  if (!value) return { type: 'empty' };

  if (value.startsWith('/todo')) {
    const rest = value.slice('/todo'.length).trim();
    const byIdx = rest.indexOf(' /by ');
    let text = rest;
    let deadline: string | null = null;
    if (byIdx !== -1) {
      text = rest.slice(0, byIdx).trim();
      deadline = rest.slice(byIdx + 5).trim();
    }
    if (!text) return { type: 'empty' };
    return { type: 'todo', text, deadline };
  }

  if (value.startsWith('/done')) {
    const task = value.slice('/done'.length).trim();
    if (!task) return { type: 'empty' };
    return { type: 'done', task };
  }

  if (value.startsWith('/important')) {
    const text = value.slice('/important'.length).trim();
    if (!text) return { type: 'empty' };
    return { type: 'important', text };
  }

  return { type: 'log', text: value };
}
