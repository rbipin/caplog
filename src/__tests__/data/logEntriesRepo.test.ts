import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock, executeMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
  executeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({ query: queryMock, execute: executeMock }));

import { logEntriesRepo } from '../../data/logEntriesRepo';

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue([]);
  executeMock.mockResolvedValue(undefined);
});

describe('logEntriesRepo', () => {
  it('listRecent queries with a cutoff date param (today - days)', async () => {
    await logEntriesRepo.listRecent(3);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/FROM log_entries WHERE date >= \?/);
    expect(sql).toMatch(/ORDER BY created_at ASC/);
    const expected = new Date();
    expected.setDate(expected.getDate() - 3);
    const y = expected.getFullYear();
    const m = String(expected.getMonth() + 1).padStart(2, '0');
    const d = String(expected.getDate()).padStart(2, '0');
    expect((params as string[])[0]).toBe(`${y}-${m}-${d}`);
  });

  it('listAll orders by date DESC then created_at ASC', async () => {
    await logEntriesRepo.listAll();
    expect(queryMock.mock.calls[0][0]).toMatch(/ORDER BY date DESC, created_at ASC/);
  });

  it('getByDate filters by date', async () => {
    await logEntriesRepo.getByDate('2026-06-01');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/WHERE date = \?/);
    expect(params).toEqual(['2026-06-01']);
  });

  it('insert executes INSERT then returns the new id', async () => {
    queryMock.mockResolvedValue([{ id: 42 }]);
    const id = await logEntriesRepo.insert('2026-06-01', 'raw', '- formatted');
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO log_entries'),
      expect.arrayContaining(['2026-06-01', 'raw', '- formatted'])
    );
    expect(id).toBe(42);
  });

  it('update writes raw_text and formatted_text by id', async () => {
    await logEntriesRepo.update(7, 'r', '- f');
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE log_entries SET raw_text = ?, formatted_text = ? WHERE id = ?',
      ['r', '- f', 7]
    );
  });

  it('remove deletes by id', async () => {
    await logEntriesRepo.remove(9);
    expect(executeMock).toHaveBeenCalledWith('DELETE FROM log_entries WHERE id = ?', [9]);
  });

  it('listDayStats limits by days', async () => {
    await logEntriesRepo.listDayStats(5);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/LIMIT \?/);
    expect(params).toEqual([5]);
  });
});
