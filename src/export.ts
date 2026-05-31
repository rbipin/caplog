import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { query } from './db.js';

interface ExportEntry {
  date: string;
  formatted_text: string;
  created_at: string;
}

export async function exportMarkdown(): Promise<void> {
  const entries = await query<ExportEntry>(
    'SELECT date, formatted_text, created_at FROM log_entries ORDER BY date DESC, created_at ASC'
  );

  const grouped = new Map<string, string[]>();
  for (const e of entries) {
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    const text = e.formatted_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    grouped.get(e.date)!.push(`- ${text}`);
  }

  let md = '# DayLog Export\n\n';
  for (const [date, lines] of grouped.entries()) {
    const d = new Date(date + 'T00:00:00');
    md += `## ${d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n\n`;
    md += lines.join('\n') + '\n\n';
  }

  const today = new Date().toISOString().split('T')[0];
  const path = await save({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    defaultPath: `daylog-export-${today}.md`,
  });

  if (path) await writeTextFile(path, md);
}
