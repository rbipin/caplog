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
});
