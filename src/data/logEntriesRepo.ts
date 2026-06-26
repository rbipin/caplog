import { query, execute } from '../db.js';
import { formatLocalDate, getToday, nowLocalIso } from '../utils.js';
import type { DayStats, LogEntry } from '../types.js';

/**
 * Repository for `log_entries`. The only place (besides the sibling repos)
 * permitted to import `db.ts`. Returns typed domain objects so a future web
 * move only needs to reimplement this layer against `fetch`.
 */
export const logEntriesRepo = {
  /** Log entries on/after `today - days`, oldest first. */
  async listRecent(days: number): Promise<LogEntry[]> {
    const cutoff = cutoffDate(days);
    return query<LogEntry>(
      'SELECT * FROM log_entries WHERE date >= ? ORDER BY created_at ASC',
      [cutoff]
    );
  },

  /** Every log entry, newest day first then oldest entry within a day. */
  async listAll(): Promise<LogEntry[]> {
    return query<LogEntry>(
      'SELECT * FROM log_entries ORDER BY date DESC, created_at ASC'
    );
  },

  /** Log entries for a single local date, oldest first. */
  async getByDate(date: string): Promise<LogEntry[]> {
    return query<LogEntry>(
      'SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC',
      [date]
    );
  },

  /** Insert an entry and return its new id. */
  async insert(date: string, rawText: string, formattedText: string): Promise<number> {
    await execute(
      'INSERT INTO log_entries (date, raw_text, formatted_text, created_at) VALUES (?, ?, ?, ?)',
      [date, rawText, formattedText, nowLocalIso()]
    );
    const rows = await query<{ id: number }>(
      'SELECT id FROM log_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1',
      [date]
    );
    return rows[0]?.id ?? -1;
  },

  /** Rewrite an entry's raw + formatted text. */
  async update(id: number, rawText: string, formattedText: string): Promise<void> {
    await execute(
      'UPDATE log_entries SET raw_text = ?, formatted_text = ? WHERE id = ?',
      [rawText, formattedText, id]
    );
  },

  async remove(id: number): Promise<void> {
    await execute('DELETE FROM log_entries WHERE id = ?', [id]);
  },

  /** Per-day stats for the sidebar window (log + todo-only days), newest first. */
  async listDayStats(days: number): Promise<DayStats[]> {
    return query<DayStats>(
      `
      SELECT date, log_count, todo_done_count, preview FROM (
        SELECT
          l.date,
          COUNT(l.id) AS log_count,
          (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
          (SELECT formatted_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
        FROM log_entries l
        GROUP BY l.date

        UNION

        SELECT
          DATE(t.completed_at) AS date,
          0 AS log_count,
          COUNT(*) AS todo_done_count,
          (SELECT text FROM todos WHERE DATE(completed_at) = DATE(t.completed_at) ORDER BY completed_at ASC LIMIT 1) AS preview
        FROM todos t
        WHERE t.completed_at IS NOT NULL
          AND DATE(t.completed_at) NOT IN (SELECT date FROM log_entries)
        GROUP BY DATE(t.completed_at)
      )
      ORDER BY date DESC
      LIMIT ?
    `,
      [days]
    );
  },
};

function cutoffDate(days: number): string {
  const today = getToday();
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
}
