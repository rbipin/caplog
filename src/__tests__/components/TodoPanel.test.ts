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
  <div id="logModal"><div id="modalSubtitle"></div><div id="modalBody"></div>
    <button id="modalCloseBtn"></button><button id="modalFooterCloseBtn"></button></div>
  <div id="settingsModal">
    <select id="llmProviderSelect"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
    <input id="apiKeyInput" /><input id="llmModelInput" /><input id="llmBaseUrlInput" />
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" /><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
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

  it('todos completed 8+ days ago appear in a collapsed Archive section', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 8);
    const archived = makeTodo({ id: 20, text: 'Old done', is_completed: 1, completed_at: old.toISOString() });
    await triggerReload([archived]);

    const labels = Array.from(document.querySelectorAll('#todoList .todo-section-label, #todoList summary')).map(el => el.textContent ?? '');
    expect(labels.some(l => l.includes('Archive'))).toBe(true);

    const details = document.querySelector('#todoList details') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
  });
});
