import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db.js', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  query: queryMock,
  execute: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../llm/factory.js', () => ({ getAdapter: vi.fn().mockResolvedValue(null) }));
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
    document.getElementById('archiveModal')!.classList.remove('visible');
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
});
