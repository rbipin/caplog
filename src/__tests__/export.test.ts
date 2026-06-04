import { describe, it, expect, vi, beforeEach } from 'vitest';

const { saveMock, writeTextFileMock, queryMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  writeTextFileMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: saveMock }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: writeTextFileMock }));
vi.mock('../db.js', () => ({ query: queryMock }));

import { exportMarkdown } from '../export.js';

const sampleEntries = [
  { date: '2026-06-01', formatted_text: '<ul><li>Entry one</li></ul>', created_at: '2026-06-01T10:00:00Z' },
  { date: '2026-06-01', formatted_text: '<ul><li>Entry two</li></ul>', created_at: '2026-06-01T11:00:00Z' },
  { date: '2026-05-31', formatted_text: '<p>Older entry</p>', created_at: '2026-05-31T09:00:00Z' },
];

describe('exportMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockResolvedValue(sampleEntries);
    saveMock.mockResolvedValue('/tmp/export.md');
    writeTextFileMock.mockResolvedValue(undefined);
  });

  it('queries log_entries ordered by date DESC and created_at ASC', async () => {
    await exportMarkdown();
    const [sql] = queryMock.mock.calls[0];
    expect(sql).toContain('log_entries');
    expect(sql).toMatch(/ORDER BY.*date DESC.*created_at ASC/i);
  });

  it('entries are grouped by date with correct headings', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    const headings = md.match(/^## .+$/gm) ?? [];
    expect(headings.length).toBe(2);
    expect(headings.some(h => h.includes('2026'))).toBe(true);
  });

  it('HTML is stripped from formatted_text in output', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    expect(md).not.toContain('<ul>');
    expect(md).not.toContain('<li>');
    expect(md).not.toContain('<p>');
    expect(md).toContain('Entry one');
    expect(md).toContain('Entry two');
    expect(md).toContain('Older entry');
  });

  it('each entry is rendered as a list item (prefixed with -)', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    expect(md).toContain('- Entry one');
    expect(md).toContain('- Entry two');
    expect(md).toContain('- Older entry');
  });

  it('save() is called with markdown filter and a default path', async () => {
    await exportMarkdown();
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.arrayContaining([
          expect.objectContaining({ extensions: expect.arrayContaining(['md']) }),
        ]),
        defaultPath: expect.stringMatching(/caplog-export.*\.md/),
      })
    );
  });

  it('if save() returns a path, writeTextFile is called with that path and markdown content', async () => {
    saveMock.mockResolvedValue('/tmp/export.md');
    await exportMarkdown();
    expect(writeTextFileMock).toHaveBeenCalledWith('/tmp/export.md', expect.any(String));
    const md = writeTextFileMock.mock.calls[0][1] as string;
    expect(md).toContain('# CapLog Export');
  });

  it('if save() returns null, writeTextFile is not called', async () => {
    saveMock.mockResolvedValue(null);
    await exportMarkdown();
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });

  it('output starts with a top-level # DayLog Export heading', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    expect(md).toMatch(/^# CapLog Export/);
  });

  it('entries from the same date appear under the same heading', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    const headings = md.match(/^## /gm) ?? [];
    expect(headings.length).toBe(2);
  });
});
