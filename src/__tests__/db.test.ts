import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    execute: vi.fn(),
  };
  return { mockDb };
});

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue(mockDb),
  },
}));

// Import AFTER mock declaration
import { initDB, query, execute, getSetting, setSetting } from '../db.js';

describe('db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('after initDB', () => {
    beforeEach(async () => {
      mockDb.select.mockResolvedValue([]);
      mockDb.execute.mockResolvedValue(undefined);
      await initDB();
    });

    it('query delegates to db.select with correct SQL and params', async () => {
      mockDb.select.mockResolvedValue([{ id: 1 }]);
      const result = await query('SELECT * FROM todos WHERE id = ?', [1]);
      expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM todos WHERE id = ?', [1]);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('query uses empty array as default params', async () => {
      mockDb.select.mockResolvedValue([]);
      await query('SELECT * FROM todos');
      expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM todos', []);
    });

    it('execute delegates to db.execute with correct SQL and params', async () => {
      await execute('INSERT INTO todos VALUES (?)', ['x']);
      expect(mockDb.execute).toHaveBeenCalledWith('INSERT INTO todos VALUES (?)', ['x']);
    });

    it('execute uses empty array as default params', async () => {
      await execute('DELETE FROM todos');
      expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM todos', []);
    });

    it('getSetting returns value when row found', async () => {
      mockDb.select.mockResolvedValue([{ value: 'anthropic' }]);
      expect(await getSetting('llm_provider')).toBe('anthropic');
    });

    it('getSetting queries settings table with the correct key', async () => {
      mockDb.select.mockResolvedValue([{ value: 'gpt-4' }]);
      await getSetting('model');
      expect(mockDb.select).toHaveBeenCalledWith(
        'SELECT value FROM settings WHERE key = ?',
        ['model']
      );
    });

    it('getSetting returns null when no rows', async () => {
      mockDb.select.mockResolvedValue([]);
      expect(await getSetting('nonexistent')).toBeNull();
    });

    it('setSetting calls execute with upsert SQL containing ON CONFLICT', async () => {
      await setSetting('llm_provider', 'openai');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['llm_provider', 'openai']
      );
    });

    it('setSetting passes key and value as params in correct order', async () => {
      await setSetting('theme', 'dark');
      const [, params] = mockDb.execute.mock.calls[0];
      expect(params).toEqual(['theme', 'dark']);
    });
  });
});
