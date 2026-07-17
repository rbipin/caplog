import { query, execute } from '../db.js';
import { nowLocalIso } from '../utils.js';

/**
 * Repository for the single-row `notes` table (id = 1, no multi-note
 * support). Only this module (besides sibling repos) may import `db.ts`.
 */
export const notesRepo = {
  async getNote(): Promise<string> {
    const rows = await query<{ content: string }>('SELECT content FROM notes WHERE id = 1', []);
    return rows.length > 0 ? rows[0].content : '';
  },

  async saveNote(content: string): Promise<void> {
    await execute('UPDATE notes SET content = ?, updated_at = ? WHERE id = 1', [
      content,
      nowLocalIso(),
    ]);
  },
};
