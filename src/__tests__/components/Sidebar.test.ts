import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../../components/Sidebar.js';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db.js', () => ({
  query: queryMock,
  execute: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  initDB: vi.fn().mockResolvedValue(undefined),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sidebarMonthLabel"></div>
      <div id="dayList"></div>
    `;
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
  });

  it('refresh(5) queries log_entries with LIMIT 5', async () => {
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(5);

    const call = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('log_entries') && String(sql).includes('LIMIT')
    );
    expect(call).toBeDefined();
    expect(call![1]).toEqual([5]);
  });

  it('refresh() with no arg reuses the last stored days value', async () => {
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(7);
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);

    await sidebar.refresh();

    const call = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('log_entries') && String(sql).includes('LIMIT')
    );
    expect(call).toBeDefined();
    expect(call![1]).toEqual([7]);
  });

  it('refresh(2) after refresh(7) switches LIMIT to 2', async () => {
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(7);
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);

    await sidebar.refresh(2);

    const call = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('log_entries') && String(sql).includes('LIMIT')
    );
    expect(call).toBeDefined();
    expect(call![1]).toEqual([2]);
  });

  it('renders preview as plain text stripped from formatted_text HTML', async () => {
    queryMock.mockResolvedValue([{
      date: '2026-06-01',
      log_count: 1,
      todo_done_count: 0,
      preview: '<ul><li>Meeting notes</li></ul>',
    }]);
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(3);

    const preview = document.querySelector('.day-entry-preview');
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toBe('Meeting notes');
    expect(preview!.textContent).not.toContain('<');
  });

  it('renders a day entry for a day that has only completed todos and no log entries', async () => {
    queryMock.mockResolvedValue([{
      date: '2026-06-04',
      log_count: 0,
      todo_done_count: 2,
      preview: 'Fix the login bug',
    }]);
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(3);

    const entries = document.querySelectorAll('.day-entry');
    expect(entries.length).toBe(1);
    const preview = entries[0].querySelector('.day-entry-preview');
    expect(preview!.textContent).toBe('Fix the login bug');
    const doneTags = entries[0].querySelectorAll('.tag-todo');
    expect(doneTags.length).toBe(1);
  });
});
