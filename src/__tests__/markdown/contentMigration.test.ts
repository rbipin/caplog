import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LogEntry } from '../../types.js';

const { getMock, setMock, listAllMock, updateMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn().mockResolvedValue(undefined),
  listAllMock: vi.fn().mockResolvedValue([]),
  updateMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/settingsRepo', () => ({
  settingsRepo: { get: getMock, set: setMock },
}));
vi.mock('../../data/logEntriesRepo', () => ({
  logEntriesRepo: { listAll: listAllMock, update: updateMock },
}));

import { runContentMigration } from '../../markdown/contentMigration';

function entry(o: Partial<LogEntry>): LogEntry {
  return { id: 1, date: '2026-06-01', raw_text: 'raw', formatted_text: '', created_at: 'x', ...o };
}

beforeEach(() => {
  vi.clearAllMocks();
  setMock.mockResolvedValue(undefined);
  updateMock.mockResolvedValue(undefined);
});

describe('runContentMigration', () => {
  it('converts HTML rows to Markdown and sets the content_format flag', async () => {
    getMock.mockResolvedValue(null);
    listAllMock.mockResolvedValue([
      entry({ id: 1, formatted_text: '<ul><li>a</li><li>b</li></ul>', raw_text: 'a b' }),
    ]);

    await runContentMigration();

    expect(updateMock).toHaveBeenCalledWith(1, 'a b', '- a\n- b');
    expect(setMock).toHaveBeenCalledWith('content_format', 'markdown');
  });

  it('skips rows already in Markdown (no needless update)', async () => {
    getMock.mockResolvedValue(null);
    listAllMock.mockResolvedValue([entry({ id: 2, formatted_text: '- a\n- b' })]);

    await runContentMigration();

    expect(updateMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith('content_format', 'markdown');
  });

  it('is idempotent: returns early when the flag is already set', async () => {
    getMock.mockResolvedValue('markdown');

    await runContentMigration();

    expect(listAllMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('does not throw and does not set the flag if conversion fails', async () => {
    getMock.mockResolvedValue(null);
    listAllMock.mockRejectedValue(new Error('db down'));

    await expect(runContentMigration()).resolves.toBeUndefined();
    expect(setMock).not.toHaveBeenCalled();
  });
});
