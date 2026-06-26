import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock, executeMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
  executeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({ query: queryMock, execute: executeMock }));

import { todosRepo } from '../../data/todosRepo';
import type { TodoItem } from '../../types.js';

function makeTodo(o: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 1, text: 'T', is_important: 0, is_completed: 0, deadline: null,
    created_at: '2026-06-01T10:00:00.000', completed_at: null, ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue([]);
  executeMock.mockResolvedValue(undefined);
});

describe('todosRepo', () => {
  it('list without cutoff selects all todos ordered by importance', async () => {
    await todosRepo.list();
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM todos ORDER BY is_important DESC/);
    expect(params).toBeUndefined();
  });

  it('list with cutoff filters completed todos by a cutoff date', async () => {
    await todosRepo.list(3);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/is_completed = 1 AND completed_at >= \?/);
    expect((params as string[])[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('listCompleted filters completed_at IS NOT NULL', async () => {
    await todosRepo.listCompleted();
    expect(queryMock.mock.calls[0][0]).toMatch(/completed_at IS NOT NULL/);
  });

  it('add inserts and returns new id', async () => {
    queryMock.mockResolvedValue([{ id: 11 }]);
    const id = await todosRepo.add('Buy milk', true, '2026-07-01');
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO todos'),
      ['Buy milk', 1, '2026-07-01', expect.any(String)]
    );
    expect(id).toBe(11);
  });

  it('completeTodo sets is_completed = 1 with completed_at', async () => {
    await todosRepo.completeTodo(5);
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
      [expect.any(String), 5]
    );
  });

  it('completeByText returns false when no match', async () => {
    queryMock.mockResolvedValue([]);
    expect(await todosRepo.completeByText('nope')).toBe(false);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('completeByText completes the first match and returns true', async () => {
    queryMock.mockResolvedValue([makeTodo({ id: 7, text: 'ship it' })]);
    expect(await todosRepo.completeByText('ship')).toBe(true);
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('is_completed = 1'),
      expect.arrayContaining([7])
    );
  });

  it('reopen clears completion', async () => {
    await todosRepo.reopen(3);
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?',
      [3]
    );
  });

  it('setImportant toggles is_important', async () => {
    await todosRepo.setImportant(4, true);
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET is_important = ? WHERE id = ?',
      [1, 4]
    );
  });

  it('setDeadline writes deadline (or null)', async () => {
    await todosRepo.setDeadline(4, null);
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET deadline = ? WHERE id = ?',
      [null, 4]
    );
  });

  it('updateText writes text', async () => {
    await todosRepo.updateText(4, 'new');
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET text = ? WHERE id = ?',
      ['new', 4]
    );
  });

  it('remove deletes by id', async () => {
    await todosRepo.remove(4);
    expect(executeMock).toHaveBeenCalledWith('DELETE FROM todos WHERE id = ?', [4]);
  });
});
