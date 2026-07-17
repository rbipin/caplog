import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock, executeMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  executeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({
  query: queryMock,
  execute: executeMock,
}));

import { notesRepo } from '../../data/notesRepo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notesRepo', () => {
  it('getNote returns the stored content', async () => {
    queryMock.mockResolvedValue([{ content: 'hello scribble' }]);
    expect(await notesRepo.getNote()).toBe('hello scribble');
    expect(queryMock).toHaveBeenCalledWith('SELECT content FROM notes WHERE id = 1', []);
  });

  it('getNote returns empty string if no row is found', async () => {
    queryMock.mockResolvedValue([]);
    expect(await notesRepo.getNote()).toBe('');
  });

  it('saveNote updates content and updated_at for row id 1', async () => {
    await notesRepo.saveNote('new text');
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE notes SET content = ?, updated_at = ? WHERE id = 1',
      ['new text', expect.any(String)]
    );
  });
});
