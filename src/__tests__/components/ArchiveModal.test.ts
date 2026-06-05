import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const { queryMock, executeMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
  executeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  query: queryMock,
  execute: executeMock,
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../llm/factory.js', () => ({
  getAdapter: vi.fn().mockResolvedValue(null),
  runLLMMigration: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../export.js', () => ({ exportMarkdown: vi.fn() }));
vi.mock('../../ai.js', () => ({ formatLogEntry: vi.fn().mockResolvedValue('<ul><li>ok</li></ul>') }));

const FULL_DOM = `<div id="app">
  <div id="sidebarMonthLabel"></div><div id="dayList"></div>
  <div id="chatArea"></div>
  <div id="todoList"></div><div id="todoCount"></div>
  <div id="headerDate"></div>
  <textarea id="chatInput"></textarea><button id="sendBtn">Send</button>
  <button id="sidebarToggleBtn"></button><button id="viewLogBtn"></button>
  <button id="settingsBtn"></button><button id="exportBtn"></button>
  <button id="archiveBtn"></button>
  <div id="logModal"><div id="modalSubtitle"></div><div id="modalBody"></div>
    <button id="modalCloseBtn"></button><button id="modalFooterCloseBtn"></button>
    <button id="modalExportBtn"></button></div>
  <div id="settingsModal">
    <select id="llmProviderSelect"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
    <input id="apiKeyInput" /><input id="llmModelInput" /><input id="llmBaseUrlInput" />
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" />
    <button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
  </div>
  <div class="archive-overlay" id="archiveModal">
    <input class="archive-search" id="archiveSearchInput" placeholder="Search entries..." />
    <button id="archiveYearPrev">◀</button>
    <span id="archiveYearLabel"></span>
    <button id="archiveYearNext">▶</button>
    <button id="archiveCloseBtn">✕</button>
    <div id="archiveBody"></div>
  </div>
  <div class="archive-confirm-overlay" id="archiveConfirmModal">
    <div class="archive-confirm-title" id="archiveConfirmTitle"></div>
    <div class="archive-confirm-body" id="archiveConfirmBody"></div>
    <button id="archiveConfirmCancelBtn">Cancel</button>
    <button id="archiveConfirmDeleteBtn">Delete</button>
  </div>
</div>`;

describe('ArchiveModal', () => {
  beforeAll(async () => {
    document.body.innerHTML = FULL_DOM;
    queryMock.mockResolvedValue([]);
    await import('../../app.js');
    window.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 100));
  });

  beforeEach(() => {
    queryMock.mockResolvedValue([]);
    executeMock.mockClear();
    document.getElementById('archiveModal')!.classList.remove('visible');
    document.getElementById('archiveConfirmModal')!.classList.remove('visible');
    document.getElementById('archiveBody')!.innerHTML = '';
    (document.getElementById('archiveSearchInput') as HTMLInputElement).value = '';
  });

  it('is hidden by default', () => {
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('shows when Archive button is clicked', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(true);
  });

  it('hides when close button is clicked', () => {
    document.getElementById('archiveModal')!.classList.add('visible');
    document.getElementById('archiveCloseBtn')!.click();
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('hides when Escape is pressed', () => {
    document.getElementById('archiveModal')!.classList.add('visible');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('shows current year in year label on open', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.getElementById('archiveYearLabel')!.textContent).toBe(String(new Date().getFullYear()));
  });

  it('renders week cards from DB data', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) {
        return [
          { date: '2026-06-02', entry_count: 5 },
          { date: '2026-06-03', entry_count: 3 },
        ];
      }
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.querySelectorAll('.archive-week-card').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.archive-day-tile').length).toBeGreaterThan(0);
  });

  it('marks today tile with today class', async () => {
    const today = new Date().toISOString().split('T')[0];
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) return [{ date: today, entry_count: 3 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.querySelector('.archive-day-tile.today')).not.toBeNull();
  });

  it('keeps archive open and opens day modal when a day tile is clicked', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) return [{ date: '2026-06-03', entry_count: 4 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const tile = document.querySelector<HTMLElement>('.archive-day-tile:not(.empty)');
    expect(tile).not.toBeNull();
    tile!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(true);
  });

  it('navigates to previous year', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    const currentYear = new Date().getFullYear();

    document.getElementById('archiveYearPrev')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveYearLabel')!.textContent).toBe(String(currentYear - 1));
  });

  it('does not navigate past the current year', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    const currentYear = new Date().getFullYear();

    document.getElementById('archiveYearNext')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveYearLabel')!.textContent).toBe(String(currentYear));
  });

  it('highlights matching day tiles on search', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) return [{ date: '2026-06-03', entry_count: 2 }];
      if (sql.includes('DISTINCT') && sql.includes('raw_text LIKE')) return [{ date: '2026-06-03' }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const input = document.getElementById('archiveSearchInput') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 300));

    expect(document.querySelector('.archive-day-tile.search-match')).not.toBeNull();
  });

  it('day tile shows a clean button for non-empty tiles', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT(*)') && sql.includes('GROUP BY')) {
        return [{ date: '2026-06-03', entry_count: 3 }];
      }
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    const cleanBtn = document.querySelector('.archive-day-tile:not(.empty) .archive-clean-btn');
    expect(cleanBtn).not.toBeNull();
  });

  it('day tile does not show a clean button for empty tiles', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT(*)') && sql.includes('GROUP BY')) {
        return [{ date: '2026-06-03', entry_count: 3 }];
      }
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    const emptyTile = document.querySelector('.archive-day-tile.empty');
    if (emptyTile) {
      expect(emptyTile.querySelector('.archive-clean-btn')).toBeNull();
    }
  });

  it('clicking day clean button opens confirm dialog with correct title', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 3 }];
      if (sql.includes('COUNT(*)') && sql.includes('log_entries') && sql.includes('date = ?')) return [{ count: 3 }];
      if (sql.includes('COUNT(*)') && sql.includes('todos') && sql.includes('DATE(created_at) = ?')) return [{ count: 1 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const cleanBtn = document.querySelector<HTMLElement>('.archive-day-tile:not(.empty) .archive-clean-btn');
    expect(cleanBtn).not.toBeNull();
    cleanBtn!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(true);
    expect(document.getElementById('archiveConfirmTitle')!.textContent).toContain('Delete');
    expect(document.getElementById('archiveConfirmBody')!.textContent).toContain('3 log entries');
    expect(document.getElementById('archiveConfirmBody')!.textContent).toContain('1 todos');
  });

  it('confirming day delete calls execute with correct SQL and reloads', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
      if (sql.includes('COUNT(*)') && sql.includes('log_entries') && sql.includes('date = ?')) return [{ count: 2 }];
      if (sql.includes('COUNT(*)') && sql.includes('todos') && sql.includes('DATE(created_at) = ?')) return [{ count: 0 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const cleanBtn = document.querySelector<HTMLElement>('.archive-day-tile:not(.empty) .archive-clean-btn');
    cleanBtn!.click();
    await new Promise(r => setTimeout(r, 60));

    document.getElementById('archiveConfirmDeleteBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(executeMock).toHaveBeenCalledWith(
      'DELETE FROM log_entries WHERE date = ?',
      ['2026-06-03']
    );
    expect(executeMock).toHaveBeenCalledWith(
      'DELETE FROM todos WHERE DATE(created_at) = ?',
      ['2026-06-03']
    );
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('week card shows a clean button', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.querySelector('.archive-week-card .archive-clean-btn')).not.toBeNull();
  });

  it('confirming week delete calls execute with date range', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
      if (sql.includes('COUNT(*)') && sql.includes('log_entries') && sql.includes('>=')) return [{ count: 2 }];
      if (sql.includes('COUNT(*)') && sql.includes('todos') && sql.includes('>=')) return [{ count: 0 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const weekClean = document.querySelector<HTMLElement>('.archive-week-card .archive-clean-btn');
    weekClean!.click();
    await new Promise(r => setTimeout(r, 60));

    document.getElementById('archiveConfirmDeleteBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(executeMock).toHaveBeenCalledWith(
      'DELETE FROM log_entries WHERE date >= ? AND date <= ?',
      expect.arrayContaining([expect.any(String), expect.any(String)])
    );
  });

  it('month divider shows a clean button', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.querySelector('.archive-month-divider .archive-clean-btn')).not.toBeNull();
  });

  it('confirming month delete calls execute with LIKE pattern', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
      if (sql.includes('COUNT(*)') && sql.includes('LIKE')) return [{ count: 2 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const monthClean = document.querySelector<HTMLElement>('.archive-month-divider .archive-clean-btn');
    monthClean!.click();
    await new Promise(r => setTimeout(r, 60));

    document.getElementById('archiveConfirmDeleteBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(executeMock).toHaveBeenCalledWith(
      'DELETE FROM log_entries WHERE date LIKE ?',
      ['2026-06-%']
    );
    expect(executeMock).toHaveBeenCalledWith(
      'DELETE FROM todos WHERE DATE(created_at) LIKE ?',
      ['2026-06-%']
    );
  });
});

describe('ArchiveConfirmModal', () => {
  it('is hidden by default', () => {
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('shows with correct title and body text', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    modal.show('Delete June 2026?', '5 log entries and 2 todos will be permanently deleted.', vi.fn());
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(true);
    expect(document.getElementById('archiveConfirmTitle')!.textContent).toBe('Delete June 2026?');
    expect(document.getElementById('archiveConfirmBody')!.textContent).toContain('5 log entries');
    modal.hide();
  });

  it('hides when cancel is clicked', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    modal.show('Delete?', 'body', vi.fn());
    document.getElementById('archiveConfirmCancelBtn')!.click();
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('calls onConfirm and hides when delete is clicked', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    const onConfirm = vi.fn();
    modal.show('Delete?', 'body', onConfirm);
    document.getElementById('archiveConfirmDeleteBtn')!.click();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('does not call onConfirm when cancel is clicked', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    const onConfirm = vi.fn();
    modal.show('Delete?', 'body', onConfirm);
    document.getElementById('archiveConfirmCancelBtn')!.click();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
