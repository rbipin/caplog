import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TodoItem } from '../../types.js';

const { executeMock, queryMock } = vi.hoisted(() => ({
  executeMock: vi.fn().mockResolvedValue(undefined),
  queryMock: vi.fn().mockResolvedValue([]),
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
vi.mock('../../ai.js', () => ({ formatLogEntry: vi.fn().mockResolvedValue('<ul><li>formatted</li></ul>') }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({ show: vi.fn() })),
}));

const FULL_DOM = `<div id="app">
  <div id="sidebarMonthLabel"></div><div id="dayList"></div>
  <div id="chatArea"></div>
  <div id="todoList"></div><div id="todoCount"></div>
  <span id="aiStatusPill" class="pill pill-yellow"></span>
  <div id="headerDate"></div>
  <textarea id="chatInput"></textarea><button id="sendBtn">Send</button>
  <button id="sidebarToggleBtn"></button><button id="viewLogBtn"></button>
  <button id="settingsBtn"></button><button id="exportBtn"></button>
  <div id="logModal"><div id="modalSubtitle"></div><div id="modalBody"></div>
    <button id="modalCloseBtn"></button><button id="modalFooterCloseBtn"></button>
    <button id="modalExportBtn"></button></div>
  <div id="settingsModal">
    <select id="llmProviderSelect"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
    <input id="apiKeyInput" /><input id="llmModelInput" /><input id="llmBaseUrlInput" />
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" /><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
  </div>
  <button id="archiveBtn"></button>
  <div class="archive-overlay" id="archiveModal">
    <input class="archive-search" id="archiveSearchInput" />
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

const DAY = '2026-06-25';

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 1,
    text: 'A todo',
    is_important: 0,
    is_completed: 1,
    deadline: null,
    // Created on an earlier day, completed on DAY — this is the bug scenario.
    created_at: '2026-06-24T09:00:00.000Z',
    completed_at: `${DAY}T14:00:00.000Z`,
    ...overrides,
  };
}

const completedTodos: TodoItem[] = [
  makeTodo({ id: 1, text: 'Ship the release' }),
  makeTodo({ id: 2, text: 'Review the PR' }),
  makeTodo({ id: 3, text: 'Update the changelog' }),
  makeTodo({ id: 4, text: 'Close the milestone' }),
  makeTodo({ id: 5, text: 'Email the team' }),
];

function isSidebarUnionQuery(sql: string): boolean {
  return sql.includes('todo_done_count') && sql.includes('UNION') && sql.includes('LIMIT');
}

function setupQueryRouting(): void {
  queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (isSidebarUnionQuery(s)) {
      return [{ date: DAY, log_count: 0, todo_done_count: 5, preview: 'Ship the release' }];
    }
    // App.openDayModal fetches todos completed on the selected day.
    if (s.includes('FROM todos') && s.includes('completed_at') && params && params[0] === DAY) {
      return completedTodos;
    }
    return [];
  });
}

async function bootApp(): Promise<void> {
  vi.resetModules();
  setupQueryRouting();
  await import('../../app.js');
  window.dispatchEvent(new Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 100));
}

describe('Day log modal — completed todos', () => {
  beforeEach(() => {
    document.body.innerHTML = FULL_DOM;
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
  });

  it('renders todos completed on the day under "Completed Todos" when a sidebar day is opened', async () => {
    await bootApp();

    const dayEntry = document.querySelector('#dayList .day-entry') as HTMLElement | null;
    expect(dayEntry).not.toBeNull();

    dayEntry!.click();
    await new Promise((r) => setTimeout(r, 30));

    const body = document.getElementById('modalBody')!;
    expect(body.textContent).toContain('Completed Todos');
    for (const t of completedTodos) {
      expect(body.textContent).toContain(t.text);
    }
    expect(document.getElementById('logModal')!.classList.contains('visible')).toBe(true);
  });

  it('queries todos by completed_at (not created_at) for the opened day', async () => {
    await bootApp();

    // Only inspect queries triggered by opening the day, not startup feed loads.
    queryMock.mockClear();

    const dayEntry = document.querySelector('#dayList .day-entry') as HTMLElement;
    dayEntry.click();
    await new Promise((r) => setTimeout(r, 30));

    const todoCalls = queryMock.mock.calls.filter(([sql]) => String(sql).includes('FROM todos'));
    const completedAtCall = todoCalls.find(
      ([sql, params]) =>
        String(sql).includes('DATE(completed_at) = ?') &&
        Array.isArray(params) &&
        params[0] === DAY
    );
    expect(completedAtCall).toBeDefined();

    // Regression guard: the day modal must not fetch todos by created_at.
    const createdAtCall = todoCalls.find(([sql]) =>
      String(sql).includes('created_at LIKE')
    );
    expect(createdAtCall).toBeUndefined();
  });
});
