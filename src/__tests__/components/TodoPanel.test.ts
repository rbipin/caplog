import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
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
vi.mock('../../ai.js', () => ({ formatLogEntry: vi.fn().mockResolvedValue('<ul><li>ok</li></ul>') }));

const FULL_DOM = `<div id="app">
  <div id="sidebarMonthLabel"></div><div id="dayList"></div>
  <div id="chatArea"></div>
  <div id="todoList"></div><div id="todoCount"></div>
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

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return { id: 1, text: 'Test', is_important: 0, is_completed: 0, deadline: null,
           created_at: new Date().toISOString(), completed_at: null, ...overrides };
}

function setTodosQuery(todos: TodoItem[]) {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('todos')) return todos;
    return [];
  });
}

async function sendCommand(value: string) {
  const input = document.getElementById('chatInput') as HTMLTextAreaElement;
  input.value = value;
  document.getElementById('sendBtn')!.click();
  await new Promise(r => setTimeout(r, 50));
}

// Trigger a full render cycle: add a dummy todo so load() is called
async function triggerReload(todos: TodoItem[]) {
  setTodosQuery(todos);
  await sendCommand('/todo __trigger__');
}

describe('TodoPanel', () => {
  beforeAll(async () => {
    document.body.innerHTML = FULL_DOM;
    setTodosQuery([]);
    await import('../../app.js');
    window.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 100));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setTodosQuery([]);
  });

  it('add() calls execute with INSERT INTO todos', async () => {
    await sendCommand('/todo Buy milk');
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO todos'),
      expect.arrayContaining(['Buy milk'])
    );
  });

  it('add() calls load() after insert — query is called for the todos list', async () => {
    await sendCommand('/todo Another task');
    const todosCalls = queryMock.mock.calls.filter(([sql]) => String(sql).includes('todos'));
    expect(todosCalls.length).toBeGreaterThan(0);
  });

  it('complete(id) calls execute with UPDATE setting is_completed = 1', async () => {
    const todo = makeTodo({ id: 5, text: 'Task to complete' });
    // completeByText's query returns the matching todo
    queryMock.mockImplementationOnce(async () => [todo]);
    // subsequent load returns empty
    queryMock.mockImplementation(async () => []);
    await sendCommand('/done Task to complete');
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE todos SET is_completed = 1'),
      expect.any(Array)
    );
  });

  it('completeByText returns false when no match — chat shows "not found" text', async () => {
    queryMock.mockImplementation(async () => []);
    await sendCommand('/done nonexistent xyz abc');
    const chatText = document.getElementById('chatArea')!.textContent ?? '';
    expect(chatText).toContain('nonexistent xyz abc');
  });

  it('delete(id) calls execute with DELETE FROM todos', async () => {
    const todo = makeTodo({ id: 99, text: 'To delete' });
    await triggerReload([todo]);

    const deleteBtn = document.querySelector('.todo-delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();

    vi.clearAllMocks();
    setTodosQuery([]);
    deleteBtn.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith('DELETE FROM todos WHERE id = ?', [99]);
  });

  it('render() — important items appear under "Important" label', async () => {
    const todo = makeTodo({ id: 1, text: 'Critical', is_important: 1 });
    await triggerReload([todo]);
    const labels = Array.from(document.querySelectorAll('#todoList .todo-section-label')).map(el => el.textContent);
    expect(labels).toContain('Important');
  });

  it('render() — overdue items appear under "Due / Overdue" label', async () => {
    const todo = makeTodo({ id: 2, text: 'Past due', deadline: '2000-01-01' });
    await triggerReload([todo]);
    const labels = Array.from(document.querySelectorAll('#todoList .todo-section-label')).map(el => el.textContent);
    expect(labels).toContain('Due / Overdue');
  });

  it('render() — open count and done count in count element match data', async () => {
    const todos = [
      makeTodo({ id: 1, text: 'Open task' }),
      makeTodo({ id: 2, text: 'Done task', is_completed: 1 }),
    ];
    await triggerReload(todos);
    expect(document.getElementById('todoCount')!.textContent).toMatch(/1 open/);
    expect(document.getElementById('todoCount')!.textContent).toMatch(/1 done/);
  });

  it('completed items show checkmark ✓', async () => {
    const todo = makeTodo({ id: 3, text: 'Done', is_completed: 1 });
    await triggerReload([todo]);
    expect(document.getElementById('todoList')!.innerHTML).toContain('✓');
  });

  it('incomplete items do not show checkmark and item is present', async () => {
    const todo = makeTodo({ id: 4, text: 'Not done' });
    await triggerReload([todo]);
    const todoList = document.getElementById('todoList')!;
    expect(todoList.innerHTML).not.toContain('✓');
    expect(todoList.querySelector('.todo-item')).not.toBeNull();
  });

  it('reopen: clicking ✓ on a completed todo calls UPDATE setting is_completed = 0', async () => {
    const todo = makeTodo({ id: 7, text: 'Was done', is_completed: 1, completed_at: new Date().toISOString() });
    await triggerReload([todo]);

    vi.clearAllMocks();
    setTodosQuery([]);

    const checkEl = document.querySelector('.todo-item.completed .todo-check') as HTMLElement;
    expect(checkEl).not.toBeNull();
    checkEl.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?',
      [7]
    );
  });

  it('clicking todo text opens an edit textarea prefilled with todo text', async () => {
    const todo = makeTodo({ id: 10, text: 'Edit me' });
    await triggerReload([todo]);

    const textEl = document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement;
    expect(textEl).not.toBeNull();
    textEl.click();
    await new Promise(r => setTimeout(r, 10));

    const textarea = document.querySelector('.todo-edit-area') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('Edit me');
  });

  it('todo edit: Cancel restores original text', async () => {
    const todo = makeTodo({ id: 11, text: 'Original text' });
    await triggerReload([todo]);

    const textEl = document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement;
    textEl.click();
    await new Promise(r => setTimeout(r, 10));

    const cancelBtn = document.querySelector('.todo-edit-cancel') as HTMLButtonElement;
    cancelBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('.todo-edit-area')).toBeNull();
    expect(textEl.textContent).toBe('Original text');
  });

  it('todo edit: Save calls UPDATE todos SET text', async () => {
    const todo = makeTodo({ id: 12, text: 'Old text' });
    await triggerReload([todo]);

    const textEl = document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement;
    textEl.click();
    await new Promise(r => setTimeout(r, 10));

    const textarea = document.querySelector('.todo-edit-area') as HTMLTextAreaElement;
    textarea.value = 'New text';

    vi.clearAllMocks();
    setTodosQuery([]);
    const saveBtn = document.querySelector('.todo-edit-save') as HTMLButtonElement;
    saveBtn.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET text = ? WHERE id = ?',
      ['New text', 12]
    );
  });

  it('load() includes completed_at cutoff filter in query when days is set', async () => {
    setTodosQuery([]);
    await sendCommand('/todo __trigger__');

    const cutoffCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('FROM todos') && String(sql).includes('completed_at')
    );
    expect(cutoffCall).toBeDefined();
    const params = cutoffCall![1] as unknown[];
    expect(params).toHaveLength(1);
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cutoff date param is today minus chatDays calendar days', async () => {
    setTodosQuery([]);
    await sendCommand('/todo __trigger__');

    const cutoffCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('FROM todos') && String(sql).includes('completed_at')
    );
    const cutoffDate = (cutoffCall![1] as string[])[0];

    // App boots with default chatDays=3 (getSetting returns null → fallback 3)
    const expected = new Date();
    expected.setDate(expected.getDate() - 3);
    const expectedStr = expected.toISOString().split('T')[0];
    expect(cutoffDate).toBe(expectedStr);
  });

  // --- Meta edit (chips) tests ---

  it('ghost chips render on open todo with no deadline and is_important=0', async () => {
    const todo = makeTodo({ id: 20, text: 'Chip test', deadline: null, is_important: 0 });
    await triggerReload([todo]);

    const chips = document.querySelectorAll('.todo-item:not(.completed) .todo-chip');
    const texts = Array.from(chips).map(c => c.textContent?.trim());
    expect(texts).toContain('+ due date');
    expect(texts).toContain('☆ important');
  });

  it('ghost chips are absent on completed todos', async () => {
    const todo = makeTodo({ id: 21, text: 'Done', is_completed: 1,
                            completed_at: new Date().toISOString() });
    await triggerReload([todo]);

    const chips = document.querySelectorAll('.todo-item.completed .todo-chip');
    expect(chips.length).toBe(0);
  });

  it('filled deadline chip shows "due <value>" when todo has a deadline', async () => {
    const todo = makeTodo({ id: 22, text: 'Has deadline', deadline: '2026-07-01' });
    await triggerReload([todo]);

    const chips = Array.from(document.querySelectorAll('.todo-item:not(.completed) .todo-chip'));
    const deadlineChip = chips.find(c => c.textContent?.includes('due'));
    expect(deadlineChip).not.toBeNull();
    expect(deadlineChip!.textContent?.trim()).toBe('due 2026-07-01');
    expect(deadlineChip!.classList.contains('filled')).toBe(true);
  });

  it('filled importance chip renders "★ important" with filled class when is_important=1', async () => {
    const todo = makeTodo({ id: 32, text: 'Is important', is_important: 1 });
    await triggerReload([todo]);

    const chips = Array.from(document.querySelectorAll('.todo-item:not(.completed) .todo-chip'));
    const importanceChip = chips.find(c => c.textContent?.includes('important'));
    expect(importanceChip).not.toBeNull();
    expect(importanceChip!.textContent?.trim()).toBe('★ important');
    expect(importanceChip!.classList.contains('filled')).toBe(true);
  });

  it('startMetaEdit: clicking a chip opens div.todo-meta-edit with input and toggle', async () => {
    const todo = makeTodo({ id: 23, text: 'Open meta edit' });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    expect(chip).not.toBeNull();
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    const editRow = document.querySelector('.todo-meta-edit');
    expect(editRow).not.toBeNull();
    expect(editRow!.querySelector('input')).not.toBeNull();
    expect(editRow!.querySelector('.todo-meta-importance-btn')).toBeNull();
  });

  it('edit row pre-fills existing deadline in the input', async () => {
    const todo = makeTodo({ id: 24, text: 'Prefilled', deadline: '2026-08-15' });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
    expect(input.value).toBe('2026-08-15');
  });

  it('Save updates deadline via UPDATE todos SET deadline', async () => {
    const todo = makeTodo({ id: 25, text: 'To update', deadline: null, is_important: 0 });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
    input.value = '2026-09-01';

    vi.clearAllMocks();
    setTodosQuery([]);
    const saveBtn = document.querySelector('.todo-meta-save') as HTMLButtonElement;
    saveBtn.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET deadline = ? WHERE id = ?',
      ['2026-09-01', 25]
    );
  });

  it('Save with empty deadline input passes null to execute', async () => {
    const todo = makeTodo({ id: 26, text: 'Clear deadline', deadline: '2026-07-01' });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
    input.value = '';

    vi.clearAllMocks();
    setTodosQuery([]);
    const saveBtn = document.querySelector('.todo-meta-save') as HTMLButtonElement;
    saveBtn.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET deadline = ? WHERE id = ?',
      [null, 26]
    );
  });

  it('importance chip directly toggles is_important without opening meta-edit', async () => {
    const todo = makeTodo({ id: 34, text: 'Direct toggle', is_important: 0 });
    await triggerReload([todo]);

    const importanceChip = document.querySelector<HTMLElement>('[data-chip="importance"]');
    expect(importanceChip).not.toBeNull();

    vi.clearAllMocks();
    setTodosQuery([]);
    importanceChip!.click();
    await new Promise(r => setTimeout(r, 30));

    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE todos SET is_important = ? WHERE id = ?',
      [1, 34]
    );
    expect(document.querySelector('.todo-meta-edit')).toBeNull();
  });

  it('mutual exclusion: opening text edit then clicking chip closes text edit and opens meta edit', async () => {
    const todo = makeTodo({ id: 28, text: 'Mutual exclusion' });
    await triggerReload([todo]);

    const textEl = document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement;
    textEl.click();
    await new Promise(r => setTimeout(r, 10));
    expect(document.querySelector('.todo-edit-area')).not.toBeNull();

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('.todo-edit-area')).toBeNull();
    expect(document.querySelector('.todo-meta-edit')).not.toBeNull();
  });

  it('Escape key closes meta edit without calling execute', async () => {
    const todo = makeTodo({ id: 29, text: 'Escape test' });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    vi.clearAllMocks();
    const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('.todo-meta-edit')).toBeNull();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('clicking deadline input inside open meta-edit does not complete the todo', async () => {
    const todo = makeTodo({ id: 30, text: 'No accidental complete' });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));

    vi.clearAllMocks();
    const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
    input.click();
    await new Promise(r => setTimeout(r, 10));

    expect(executeMock).not.toHaveBeenCalledWith(
      expect.stringContaining('is_completed = 1'),
      expect.anything()
    );
    expect(document.querySelector('.todo-meta-edit')).not.toBeNull();
  });

  it('reverse mutual exclusion: meta-edit open then clicking text closes meta-edit and opens text edit', async () => {
    const todo = makeTodo({ id: 31, text: 'Reverse mutual exclusion' });
    await triggerReload([todo]);

    const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
    chip.click();
    await new Promise(r => setTimeout(r, 10));
    expect(document.querySelector('.todo-meta-edit')).not.toBeNull();

    const textEl = document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement;
    textEl.click();
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('.todo-meta-edit')).toBeNull();
    expect(document.querySelector('.todo-edit-area')).not.toBeNull();
  });
});
