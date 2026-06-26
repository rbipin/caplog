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
  { date: '2026-06-01', formatted_text: '- Entry one', created_at: '2026-06-01T10:00:00Z' },
  { date: '2026-06-01', formatted_text: '- Entry two', created_at: '2026-06-01T11:00:00Z' },
  { date: '2026-05-31', formatted_text: 'Older entry', created_at: '2026-05-31T09:00:00Z' },
];

function routeQuery(entries: unknown[], completedTodos: unknown[] = []): void {
  queryMock.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM todos')) return completedTodos;
    return entries;
  });
}

describe('exportMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeQuery(sampleEntries);
    saveMock.mockResolvedValue('/tmp/export.md');
    writeTextFileMock.mockResolvedValue(undefined);
  });

  it('queries log_entries ordered by date DESC and created_at ASC', async () => {
    await exportMarkdown();
    const logCall = queryMock.mock.calls.find(([sql]) => String(sql).includes('log_entries'));
    expect(logCall).toBeDefined();
    expect(logCall![0]).toMatch(/ORDER BY.*date DESC.*created_at ASC/i);
  });

  it('queries completed todos (completed_at IS NOT NULL)', async () => {
    await exportMarkdown();
    const todoCall = queryMock.mock.calls.find(([sql]) => String(sql).includes('FROM todos'));
    expect(todoCall).toBeDefined();
    expect(todoCall![0]).toMatch(/completed_at IS NOT NULL/i);
  });

  it('entries are grouped by date with correct headings', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    const headings = md.match(/^## .+$/gm) ?? [];
    expect(headings.length).toBe(2);
    expect(headings.some(h => h.includes('2026'))).toBe(true);
  });

  it('Markdown content is emitted directly (no HTML, passthrough)', () => {
    return exportMarkdown().then(() => {
      const md = writeTextFileMock.mock.calls[0][1] as string;
      expect(md).not.toContain('<ul>');
      expect(md).not.toContain('<li>');
      expect(md).not.toContain('<p>');
      expect(md).toContain('Entry one');
      expect(md).toContain('Entry two');
      expect(md).toContain('Older entry');
    });
  });

  it('each bullet entry is preserved as a list item', async () => {
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    expect(md).toContain('- Entry one');
    expect(md).toContain('- Entry two');
    expect(md).toContain('Older entry');
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

  it('output starts with a top-level # CapLog Export heading', async () => {
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

  it('renders completed todos as checklist items under their completion day', async () => {
    routeQuery(sampleEntries, [
      { id: 1, text: 'Ship release', is_important: 0, is_completed: 1, deadline: null,
        created_at: '2026-05-30T09:00:00.000', completed_at: '2026-06-01T14:00:00.000' },
    ]);
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    expect(md).toContain('**Completed Todos**');
    expect(md).toContain('- [x] Ship release');
  });

  it('includes a heading for a day that has only completed todos and no log entries', async () => {
    routeQuery(sampleEntries, [
      { id: 2, text: 'Todo-only work', is_important: 0, is_completed: 1, deadline: null,
        created_at: '2026-06-09T09:00:00.000', completed_at: '2026-06-10T14:00:00.000' },
    ]);
    await exportMarkdown();
    const md = writeTextFileMock.mock.calls[0][1] as string;
    const headings = md.match(/^## .+$/gm) ?? [];
    expect(headings.length).toBe(3);
    expect(md).toContain('- [x] Todo-only work');
  });
});
