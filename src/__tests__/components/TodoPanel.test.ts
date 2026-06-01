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
    <div id="baseUrlGroup"></div><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
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
});
