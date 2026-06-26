import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { query } from './db.js';
import { parseLocalDate, getToday } from './utils.js';
import { buildDayLogs } from './logAggregation.js';
import type { LogEntry, TodoItem } from './types.js';

export async function exportMarkdown(): Promise<void> {
  const [entries, completedTodos] = await Promise.all([
    query<LogEntry>(
      'SELECT date, formatted_text, created_at FROM log_entries ORDER BY date DESC, created_at ASC'
    ),
    query<TodoItem>(
      'SELECT * FROM todos WHERE completed_at IS NOT NULL ORDER BY completed_at ASC'
    ),
  ]);

  let md = '# CapLog Export\n\n';
  for (const day of buildDayLogs(entries, completedTodos)) {
    const d = parseLocalDate(day.date);
    md += `## ${d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n\n`;

    for (const item of day.items) {
      md += `- ${item.text.replace(/\s+/g, ' ').trim()}\n`;
    }

    if (day.completedTodos.length > 0) {
      if (day.items.length > 0) md += '\n';
      md += '**Completed Todos**\n\n';
      for (const t of day.completedTodos) {
        md += `- [x] ${t.text.replace(/\s+/g, ' ').trim()}\n`;
      }
    }

    md += '\n';
  }

  const today = getToday();
  const path = await save({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    defaultPath: `caplog-export-${today}.md`,
  });

  if (path) await writeTextFile(path, md);
}
