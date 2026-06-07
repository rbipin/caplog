import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { LogEntry } from '../../types.js';

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

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return { id: 1, date: '2026-06-01', raw_text: 'raw input',
           formatted_text: '<ul><li>formatted</li></ul>',
           created_at: new Date().toISOString(), ...overrides };
}

async function submitLog(value: string) {
  queryMock.mockResolvedValue([{ id: 99 }]); // for the SELECT id query after insert
  const input = document.getElementById('chatInput') as HTMLTextAreaElement;
  input.value = value;
  document.getElementById('sendBtn')!.click();
  await new Promise(r => setTimeout(r, 60));
}

describe('ChatArea', () => {
  beforeAll(async () => {
    document.body.innerHTML = FULL_DOM;

    // Return two log entries during startup loadRecentEntries()
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('DISTINCT date')) {
        return [{ date: '2026-06-01' }];
      }
      if (sql.includes('log_entries') && sql.includes('WHERE date = ?')) {
        return [
          makeEntry({ id: 10, raw_text: 'entry one', formatted_text: '<ul><li>entry one</li></ul>' }),
          makeEntry({ id: 11, raw_text: 'entry two', formatted_text: '<ul><li>entry two</li></ul>' }),
        ];
      }
      return [];
    });

    await import('../../app.js');
    window.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 100));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockResolvedValue(undefined);
    queryMock.mockResolvedValue([]);
  });

  it('loadEntries() renders multiple entries in order on startup', () => {
    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    expect(msgs.length).toBeGreaterThanOrEqual(2);
  });

  it('append() renders time, type label, and content in correct elements', async () => {
    await submitLog('Hello world');
    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    const last = msgs[msgs.length - 1];
    expect(last.querySelector('.msg-time')).not.toBeNull();
    expect(last.querySelector('.msg-type')).not.toBeNull();
    expect(last.querySelector('.msg-content')).not.toBeNull();
  });

  it('append() with rawInput renders the original-input block', async () => {
    await submitLog('My raw log entry');
    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    const last = msgs[msgs.length - 1];
    // rawInput block shown when raw_text differs from formatted_text
    expect(last.querySelector('.msg-raw')).not.toBeNull();
    expect(last.querySelector('.msg-raw-label')!.textContent).toContain('Original input');
  });

  it('append() with entryId attaches data-editable="true" to content element', async () => {
    queryMock.mockResolvedValue([{ id: 42 }]); // SELECT id returns entry id
    await submitLog('Editable entry');
    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    const last = msgs[msgs.length - 1];
    const content = last.querySelector('.msg-content') as HTMLElement;
    expect(content.dataset.editable).toBe('true');
  });

  it('edit flow: clicking content replaces it with textarea', async () => {
    queryMock.mockResolvedValue([{ id: 55 }]);
    await submitLog('Click to edit me');
    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    const last = msgs[msgs.length - 1];
    const content = last.querySelector('.msg-content') as HTMLElement;

    content.click();
    await new Promise(r => setTimeout(r, 10));

    expect(content.querySelector('textarea.msg-edit-area')).not.toBeNull();
    expect(content.querySelector('.msg-edit-cancel')).not.toBeNull();
  });

  it('edit flow: Cancel restores original HTML', async () => {
    queryMock.mockResolvedValue([{ id: 66 }]);
    await submitLog('Cancelable entry');
    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    const last = msgs[msgs.length - 1];
    const content = last.querySelector('.msg-content') as HTMLElement;
    const originalHtml = content.innerHTML;

    content.click();
    await new Promise(r => setTimeout(r, 10));

    const cancelBtn = content.querySelector('.msg-edit-cancel') as HTMLButtonElement;
    cancelBtn.click();

    expect(content.innerHTML).toBe(originalHtml);
  });

  it('delete button: clicking ✕ calls DELETE FROM log_entries and removes the message', async () => {
    queryMock.mockResolvedValueOnce([{ id: 77 }]); // SELECT id after insert
    await submitLog('Entry to delete');

    const msgs = document.getElementById('chatArea')!.querySelectorAll('.msg');
    const last = msgs[msgs.length - 1] as HTMLElement;
    const deleteBtn = last.querySelector('.msg-delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();

    vi.clearAllMocks();
    executeMock.mockResolvedValue(undefined);
    deleteBtn.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith('DELETE FROM log_entries WHERE id = ?', [77]);
    expect(document.getElementById('chatArea')!.contains(last)).toBe(false);
  });
});

describe('AI status pill', () => {
  async function bootApp(): Promise<void> {
    vi.resetModules();
    await import('../../app.js');
    window.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 100));
  }

  beforeEach(() => {
    document.body.innerHTML = FULL_DOM;
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
  });

  it('shows pill-yellow and "No AI" when adapter is null', async () => {
    const { getAdapter } = await import('../../llm/factory.js');
    vi.mocked(getAdapter).mockResolvedValue(null);

    await bootApp();

    const pill = document.getElementById('aiStatusPill')!;
    expect(pill.classList.contains('pill-yellow')).toBe(true);
    expect(pill.classList.contains('pill-green')).toBe(false);
    expect(pill.textContent).toContain('No AI');
  });

  it('shows pill-green and "AI Active" when adapter is non-null', async () => {
    const { getAdapter } = await import('../../llm/factory.js');
    vi.mocked(getAdapter).mockResolvedValue({ complete: vi.fn().mockResolvedValue('') } as any);

    await bootApp();

    const pill = document.getElementById('aiStatusPill')!;
    expect(pill.classList.contains('pill-green')).toBe(true);
    expect(pill.classList.contains('pill-yellow')).toBe(false);
    expect(pill.textContent).toContain('AI Active');
  });
});
