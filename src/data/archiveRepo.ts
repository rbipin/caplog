import { query, execute } from '../db.js';

export type ArchiveRange =
  | { type: 'day'; date: string }
  | { type: 'week'; start: string; end: string }
  | { type: 'month'; yearMonth: string };

interface RangeSql {
  entryWhere: string;
  todoWhere: string;
  params: string[];
}

function rangeSql(range: ArchiveRange): RangeSql {
  switch (range.type) {
    case 'day':
      return { entryWhere: 'date = ?', todoWhere: 'DATE(created_at) = ?', params: [range.date] };
    case 'week':
      return {
        entryWhere: 'date >= ? AND date <= ?',
        todoWhere: 'DATE(created_at) >= ? AND DATE(created_at) <= ?',
        params: [range.start, range.end],
      };
    case 'month':
      return {
        entryWhere: 'date LIKE ?',
        todoWhere: 'DATE(created_at) LIKE ?',
        params: [`${range.yearMonth}-%`],
      };
  }
}

/** Repository backing the year-calendar Archive view. Only repos import `db.ts`. */
export const archiveRepo = {
  async yearEntryCounts(year: number): Promise<Record<string, number>> {
    const rows = await query<{ date: string; entry_count: number }>(
      'SELECT date, COUNT(*) as entry_count FROM log_entries WHERE date LIKE ? GROUP BY date ORDER BY date DESC',
      [`${year}-%`]
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.date] = r.entry_count;
    return counts;
  },

  async yearDoneCounts(year: number): Promise<Record<string, number>> {
    const rows = await query<{ date: string; done_count: number }>(
      'SELECT DATE(completed_at) as date, COUNT(*) as done_count FROM todos WHERE completed_at LIKE ? GROUP BY DATE(completed_at)',
      [`${year}-%`]
    );
    const counts: Record<string, number> = {};
    for (const r of rows) if (r.date) counts[r.date] = r.done_count;
    return counts;
  },

  async searchDates(year: number, q: string): Promise<Set<string>> {
    const rows = await query<{ date: string }>(
      'SELECT DISTINCT date FROM log_entries WHERE date LIKE ? AND formatted_text LIKE ?',
      [`${year}-%`, `%${q}%`]
    );
    return new Set(rows.map((r) => r.date));
  },

  async countRange(range: ArchiveRange): Promise<{ entries: number; todos: number }> {
    const { entryWhere, todoWhere, params } = rangeSql(range);
    const [entryRows, todoRows] = await Promise.all([
      query<{ count: number }>(`SELECT COUNT(*) as count FROM log_entries WHERE ${entryWhere}`, params),
      query<{ count: number }>(`SELECT COUNT(*) as count FROM todos WHERE ${todoWhere}`, params),
    ]);
    return { entries: entryRows[0]?.count ?? 0, todos: todoRows[0]?.count ?? 0 };
  },

  async deleteRange(range: ArchiveRange): Promise<void> {
    const { entryWhere, todoWhere, params } = rangeSql(range);
    await Promise.all([
      execute(`DELETE FROM log_entries WHERE ${entryWhere}`, params),
      execute(`DELETE FROM todos WHERE ${todoWhere}`, params),
    ]);
  },
};
