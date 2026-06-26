import { query, execute } from '../db.js';
import { formatLocalDate, getToday, nowLocalIso } from '../utils.js';
import type { TodoItem } from '../types.js';

const ORDER_BY =
  'ORDER BY is_important DESC, CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at ASC';

/**
 * Repository for `todos`. Only repos may import `db.ts`.
 */
export const todosRepo = {
  /**
   * Todos for the panel. When `cutoffDays` is provided, completed todos older
   * than that many days are excluded; open todos are always included.
   */
  async list(cutoffDays?: number): Promise<TodoItem[]> {
    if (cutoffDays !== undefined) {
      const cutoff = cutoffDate(cutoffDays);
      return query<TodoItem>(
        `SELECT * FROM todos WHERE is_completed = 0 OR (is_completed = 1 AND completed_at >= ?) ${ORDER_BY}`,
        [cutoff]
      );
    }
    return query<TodoItem>(`SELECT * FROM todos ${ORDER_BY}`);
  },

  /** Every completed todo, oldest completion first. */
  async listCompleted(): Promise<TodoItem[]> {
    return query<TodoItem>(
      'SELECT * FROM todos WHERE completed_at IS NOT NULL ORDER BY completed_at ASC'
    );
  },

  async getById(id: number): Promise<TodoItem | null> {
    const rows = await query<TodoItem>('SELECT * FROM todos WHERE id = ?', [id]);
    return rows[0] ?? null;
  },

  /** Insert a todo and return its new id. */
  async add(text: string, isImportant = false, deadline: string | null = null): Promise<number> {
    await execute(
      'INSERT INTO todos (text, is_important, deadline, created_at) VALUES (?, ?, ?, ?)',
      [text, isImportant ? 1 : 0, deadline, nowLocalIso()]
    );
    const rows = await query<{ id: number }>('SELECT id FROM todos ORDER BY id DESC LIMIT 1');
    return rows[0]?.id ?? -1;
  },

  async completeTodo(id: number): Promise<void> {
    await execute('UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?', [
      nowLocalIso(),
      id,
    ]);
  },

  /** Complete the first open todo whose text contains `text` (case-insensitive). */
  async completeByText(text: string): Promise<boolean> {
    const escaped = text.replace(/[%_\\]/g, '\\$&');
    const rows = await query<TodoItem>(
      "SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?) ESCAPE '\\'",
      [`%${escaped}%`]
    );
    if (rows.length === 0) return false;
    await this.completeTodo(rows[0].id);
    return true;
  },

  async reopen(id: number): Promise<void> {
    await execute('UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?', [id]);
  },

  async setImportant(id: number, value: boolean): Promise<void> {
    await execute('UPDATE todos SET is_important = ? WHERE id = ?', [value ? 1 : 0, id]);
  },

  async setDeadline(id: number, deadline: string | null): Promise<void> {
    await execute('UPDATE todos SET deadline = ? WHERE id = ?', [deadline, id]);
  },

  async updateText(id: number, text: string): Promise<void> {
    await execute('UPDATE todos SET text = ? WHERE id = ?', [text, id]);
  },

  async remove(id: number): Promise<void> {
    await execute('DELETE FROM todos WHERE id = ?', [id]);
  },
};

function cutoffDate(days: number): string {
  const today = getToday();
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
}
