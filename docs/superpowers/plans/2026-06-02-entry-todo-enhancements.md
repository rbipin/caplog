# DayLog Entry & Todo Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete-entry, sidebar day-view modal, multi-day collapsible chat feed with todo persistence, uncheck/edit todos, and an archive section for old completed todos.

**Architecture:** All changes are frontend-only except one new SQL migration seeding `chat_days = 3`. `ChatArea` gains day-section grouping and a `currentSection` pointer so both bulk-load and runtime appends land in the right `<details>` block. `App.loadRecentEntries` merges log entries and todos by `created_at` for each day. `TodoPanel` gets `reopen()`, inline edit, and an archive `<details>` at the bottom.

**Tech Stack:** Vanilla TypeScript, Tauri v2 IPC, SQLite via tauri-plugin-sql, Vitest + happy-dom tests.

---

## File Map

| File | Action |
|------|--------|
| `src-tauri/migrations/002_settings_chat_days.sql` | Create |
| `index.html` | Modify — add `chatDaysInput` to settings modal |
| `src/todoLogic.ts` | Modify — split completed section into recent + archive |
| `src/components/TodoPanel.ts` | Modify — reopen, inline edit, archive render |
| `src/components/ChatArea.ts` | Modify — day sections, currentSection, delete, onSidebarRefresh |
| `src/components/Sidebar.ts` | Modify — onDaySelect callback |
| `src/components/LogModal.ts` | Modify — add openDay() method |
| `src/components/SettingsModal.ts` | Modify — chat_days field |
| `src/app.ts` | Modify — loadRecentEntries, openDayModal, wiring |
| `src/styles.css` | Modify — new styles for all features |
| `src/__tests__/todoLogic.test.ts` | Modify — add archive section tests |
| `src/__tests__/components/ChatArea.test.ts` | Modify — update query mocks, add delete test |
| `src/__tests__/components/TodoPanel.test.ts` | Modify — update DOM, add reopen/edit/archive tests |
| `src/__tests__/components/SettingsModal.test.ts` | Modify — update DOM and save/open assertions |

---

## Task 1: DB Migration + Settings UI

**Files:**
- Create: `src-tauri/migrations/002_settings_chat_days.sql`
- Modify: `index.html`
- Modify: `src/components/SettingsModal.ts`
- Modify: `src/__tests__/components/SettingsModal.test.ts`

- [ ] **Step 1: Create the migration file**

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_days', '3');
```

- [ ] **Step 2: Add the input to index.html — inside `.settings-body`, before the `<p class="settings-hint">` line near the bottom**

Replace this block in `index.html`:

```html
          <p class="settings-hint">Used for AI log formatting. Stored locally, never sent anywhere else.</p>
          <button id="saveSettingsBtn" class="settings-save-btn">Save</button>
```

With:

```html
          <label class="settings-label">Days to show in chat</label>
          <input type="number" id="chatDaysInput" class="settings-input" min="1" max="14" placeholder="3" />

          <p class="settings-hint">Used for AI log formatting. Stored locally, never sent anywhere else.</p>
          <button id="saveSettingsBtn" class="settings-save-btn">Save</button>
```

- [ ] **Step 3: Update SettingsModal.ts**

Replace the full file content:

```ts
import { execute, getSetting, setSetting } from '../db.js';

export class SettingsModal {
  private overlay: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private baseUrlInput: HTMLInputElement;
  private baseUrlGroup: HTMLElement;
  private chatDaysInput: HTMLInputElement;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.providerSelect = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.modelInput = document.getElementById('llmModelInput') as HTMLInputElement;
    this.baseUrlInput = document.getElementById('llmBaseUrlInput') as HTMLInputElement;
    this.baseUrlGroup = document.getElementById('baseUrlGroup')!;
    this.chatDaysInput = document.getElementById('chatDaysInput') as HTMLInputElement;

    document.getElementById('settingsCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.getElementById('saveSettingsBtn')!.addEventListener('click', () => { void this.save(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.close(); });

    this.providerSelect.addEventListener('change', () => this.syncBaseUrlVisibility());
    this.syncBaseUrlVisibility();
  }

  private syncBaseUrlVisibility(): void {
    this.baseUrlGroup.style.display = this.providerSelect.value === 'openai' ? 'block' : 'none';
  }

  async open(): Promise<void> {
    const [provider, apiKey, model, baseUrl, chatDays] = await Promise.all([
      getSetting('llm_provider'),
      getSetting('llm_api_key'),
      getSetting('llm_model'),
      getSetting('llm_base_url'),
      getSetting('chat_days'),
    ]);

    this.providerSelect.value = provider ?? 'anthropic';
    this.apiKeyInput.value = apiKey ?? '';
    this.modelInput.value = model ?? '';
    this.baseUrlInput.value = baseUrl ?? '';
    this.chatDaysInput.value = chatDays ?? '3';
    this.syncBaseUrlVisibility();
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  private async save(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      await Promise.all([
        execute('DELETE FROM settings WHERE key = ?', ['llm_provider']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_api_key']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_model']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_base_url']),
        execute('DELETE FROM settings WHERE key = ?', ['chat_days']),
      ]);
      this.close();
      return;
    }

    const provider = this.providerSelect.value;
    const model = this.modelInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();
    const chatDays = Math.max(1, Math.min(14, parseInt(this.chatDaysInput.value) || 3)).toString();

    if (!model) {
      alert('Please enter a model name.');
      return;
    }

    await setSetting('llm_provider', provider);
    await setSetting('llm_api_key', apiKey);
    await setSetting('llm_model', model);
    await setSetting('llm_base_url', provider === 'openai' ? baseUrl : '');
    await setSetting('chat_days', chatDays);

    this.close();
  }
}
```

- [ ] **Step 4: Update SettingsModal.test.ts — add chatDaysInput to FULL_DOM**

In `SettingsModal.test.ts`, find the `settingsModal` div in `FULL_DOM` and add the new input. Replace:

```
    <div id="baseUrlGroup"></div><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
```

With:

```
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" /><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
```

- [ ] **Step 5: Update SettingsModal.test.ts — fix the "deletes all four setting rows" test (now 5)**

Find and replace:

```ts
    const deleteCalls = executeMock.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM settings'));
    expect(deleteCalls.length).toBe(4);
```

With:

```ts
    const deleteCalls = executeMock.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM settings'));
    expect(deleteCalls.length).toBe(5);
```

- [ ] **Step 6: Update SettingsModal.test.ts — fix "open() reads all four settings" mock to include chat_days**

Find and replace the `getSettingMock.mockImplementation` inside that test:

```ts
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'llm_provider') return 'anthropic';
      if (key === 'llm_api_key') return 'sk-test-key';
      if (key === 'llm_model') return 'claude-haiku-4-5-20251001';
      if (key === 'llm_base_url') return '';
      if (key === 'chat_days') return '3';
      return null;
    });
```

- [ ] **Step 7: Run tests**

```bash
pnpm test src/__tests__/components/SettingsModal.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/migrations/002_settings_chat_days.sql index.html src/components/SettingsModal.ts src/__tests__/components/SettingsModal.test.ts
git commit -m "feat: add chat_days setting to DB migration and settings modal"
```

---

## Task 2: todoLogic — Split Completed into Recent + Archive

**Files:**
- Modify: `src/todoLogic.ts`
- Modify: `src/__tests__/todoLogic.test.ts`

- [ ] **Step 1: Write failing tests for the new sections**

Add to `src/__tests__/todoLogic.test.ts` after the existing `getTodoSections` describe block:

```ts
describe('getTodoSections — archive split', () => {
  it('recently completed todo (today) appears in Completed section, not Archive', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const archive = sections.find(s => s.label === 'Archive')!;
    const recent = makeTodo({ is_completed: 1, completed_at: new Date().toISOString() });
    expect(completed.filter(recent)).toBe(true);
    expect(archive.filter(recent)).toBe(false);
  });

  it('todo completed 8 days ago appears in Archive section, not Completed', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const archive = sections.find(s => s.label === 'Archive')!;
    const old = new Date();
    old.setDate(old.getDate() - 8);
    const oldTodo = makeTodo({ is_completed: 1, completed_at: old.toISOString() });
    expect(completed.filter(oldTodo)).toBe(false);
    expect(archive.filter(oldTodo)).toBe(true);
  });

  it('Archive section has collapsed: true', () => {
    const sections = getTodoSections();
    const archive = sections.find(s => s.label === 'Archive')!;
    expect((archive as any).collapsed).toBe(true);
  });

  it('completed todo with null completed_at falls into Archive', () => {
    const sections = getTodoSections();
    const archive = sections.find(s => s.label === 'Archive')!;
    const noDate = makeTodo({ is_completed: 1, completed_at: null });
    expect(archive.filter(noDate)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/todoLogic.test.ts
```

Expected: 4 new tests fail (Archive section not found, Completed section has old behavior).

- [ ] **Step 3: Update todoLogic.ts**

Replace the full file:

```ts
import { TodoItem } from './types.js';

export type TodoSection = {
  label: string;
  filter: (t: TodoItem) => boolean;
  collapsed?: boolean;
};

export function todoStatus(todo: TodoItem): 'completed' | 'important' | 'overdue' | 'open' {
  if (todo.is_completed) return 'completed';
  if (todo.is_important) return 'important';
  if (todo.deadline) {
    const today = new Date().toISOString().split('T')[0];
    if (todo.deadline <= today) return 'overdue';
  }
  return 'open';
}

export function getTodoSections(): TodoSection[] {
  const today = new Date().toISOString().split('T')[0];
  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - 7);
  const cutoffIso = archiveCutoff.toISOString();

  return [
    { label: 'Important', filter: (t) => !t.is_completed && !!t.is_important },
    { label: 'Due / Overdue', filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
    { label: 'Open', filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
    { label: 'Completed', filter: (t) => !!t.is_completed && !!t.completed_at && t.completed_at >= cutoffIso },
    { label: 'Archive', filter: (t) => !!t.is_completed && (!t.completed_at || t.completed_at < cutoffIso), collapsed: true },
  ];
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/__tests__/todoLogic.test.ts
```

Expected: all tests pass (9 total).

- [ ] **Step 5: Commit**

```bash
git add src/todoLogic.ts src/__tests__/todoLogic.test.ts
git commit -m "feat: split completed todos into recent and archived sections"
```

---

## Task 3: TodoPanel — reopen()

**Files:**
- Modify: `src/components/TodoPanel.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('TodoPanel', ...)` block in `TodoPanel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|FAIL|PASS|reopen"
```

Expected: new test fails.

- [ ] **Step 3: Add reopen() and update renderItem() in TodoPanel.ts**

In `TodoPanel.ts`, add `reopen` method after `complete`:

```ts
  async reopen(id: number): Promise<void> {
    await execute('UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?', [id]);
    await this.load();
  }
```

In `renderItem()`, find the block that only attaches click for non-completed items:

```ts
    if (status !== 'completed') {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.todo-delete-btn')) return;
        this.complete(todo.id);
      });
    }
```

Replace with:

```ts
    if (status !== 'completed') {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.todo-delete-btn')) return;
        if ((e.target as HTMLElement).closest('.todo-text')) return;
        this.complete(todo.id);
      });
    } else {
      const checkEl = el.querySelector('.todo-check') as HTMLElement;
      checkEl.style.cursor = 'pointer';
      checkEl.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.reopen(todo.id);
      });
    }
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoPanel.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: allow unchecking completed todos to reopen them"
```

---

## Task 4: TodoPanel — Inline Edit

**Files:**
- Modify: `src/components/TodoPanel.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('TodoPanel', ...)` in `TodoPanel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|edit"
```

Expected: 3 new tests fail.

- [ ] **Step 3: Add startTodoEdit() to TodoPanel.ts and wire click on .todo-text**

Add private method to `TodoPanel` class:

```ts
  private startTodoEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void {
    if (el.querySelector('textarea.todo-edit-area')) return;

    const original = textEl.textContent ?? '';
    textEl.textContent = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'todo-edit-area';
    textarea.value = todo.text;
    textEl.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'todo-edit-actions';
    actions.innerHTML = '<button class="todo-edit-save">Save</button><button class="todo-edit-cancel">Cancel</button>';
    textEl.appendChild(actions);

    textarea.focus();

    const cancel = () => { textEl.textContent = original; };

    actions.querySelector('.todo-edit-cancel')!.addEventListener('click', (e) => {
      e.stopPropagation();
      cancel();
    });

    actions.querySelector('.todo-edit-save')!.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newText = textarea.value.trim();
      if (!newText) return;
      await execute('UPDATE todos SET text = ? WHERE id = ?', [newText, todo.id]);
      await this.load();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (actions.querySelector('.todo-edit-save') as HTMLButtonElement).click();
      }
      if (e.key === 'Escape') cancel();
    });
  }
```

In `renderItem()`, inside the `if (status !== 'completed')` block (after the item click listener), add the text click handler:

```ts
      const textEl = el.querySelector('.todo-text') as HTMLElement;
      textEl.style.cursor = 'text';
      textEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startTodoEdit(el, textEl, todo);
      });
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoPanel.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: add inline edit for todo items"
```

---

## Task 5: TodoPanel — Archive Render Section

**Files:**
- Modify: `src/components/TodoPanel.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Write failing test**

Add inside `describe('TodoPanel', ...)`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|Archive"
```

Expected: new test fails.

- [ ] **Step 3: Update the render() method in TodoPanel.ts to handle collapsed sections**

Replace the `render` method:

```ts
  private render(todos: TodoItem[]): void {
    this.listEl.innerHTML = '';

    const sections = getTodoSections();

    for (const section of sections) {
      const items = todos.filter(section.filter);
      if (items.length === 0) continue;

      if (section.collapsed) {
        const details = document.createElement('details');
        details.className = 'todo-archive';
        const summary = document.createElement('summary');
        summary.className = 'todo-section-label todo-archive-summary';
        summary.textContent = `${section.label} (${items.length})`;
        details.appendChild(summary);
        for (const item of items) details.appendChild(this.renderItem(item));
        this.listEl.appendChild(details);
      } else {
        const label = document.createElement('div');
        label.className = 'todo-section-label';
        label.textContent = section.label;
        this.listEl.appendChild(label);
        for (const item of items) this.listEl.appendChild(this.renderItem(item));
      }
    }

    const open = todos.filter((t) => !t.is_completed).length;
    const done = todos.filter((t) => t.is_completed).length;
    this.countEl.textContent = `${open} open · ${done} done`;
  }
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoPanel.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: show completed todos older than 7 days in a collapsed Archive section"
```

---

## Task 6: ChatArea — Day Sections, Todo Persistence, Delete Button

**Files:**
- Modify: `src/components/ChatArea.ts`
- Modify: `src/__tests__/components/ChatArea.test.ts`

- [ ] **Step 1: Update FULL_DOM in ChatArea.test.ts to include chatDaysInput**

In `ChatArea.test.ts`, find and replace the settings modal section of `FULL_DOM`:

```
    <div id="baseUrlGroup"></div><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
```

With:

```
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" /><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
```

- [ ] **Step 2: Update the beforeAll query mock in ChatArea.test.ts**

The old mock matched `sql.includes('log_entries') && sql.includes('date = ?')`. The new `loadRecentEntries` first queries for distinct dates, then per-date entries and todos. Replace the `beforeAll` block's `queryMock.mockImplementation`:

```ts
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
```

- [ ] **Step 3: Add delete-button test to ChatArea.test.ts**

Add inside `describe('ChatArea', ...)`:

```ts
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
```

- [ ] **Step 4: Run tests to verify the new delete test fails and existing tests still pass**

```bash
pnpm test src/__tests__/components/ChatArea.test.ts
```

Expected: existing tests pass, delete-button test fails.

- [ ] **Step 5: Replace ChatArea.ts with the new implementation**

```ts
import { execute } from '../db.js';
import { formatLogEntry } from '../ai.js';
import { getAdapter } from '../llm/factory.js';
import { escapeHtml } from '../utils.js';
import type { Message, LogEntry } from '../types.js';

export class ChatArea {
  private el: HTMLElement;
  private currentSection: HTMLElement | null = null;
  private onSidebarRefresh: (() => void) | null = null;

  constructor() {
    this.el = document.getElementById('chatArea')!;
  }

  setSidebarRefresh(fn: () => void): void {
    this.onSidebarRefresh = fn;
  }

  appendDaySection(label: string, dateSubLabel: string, isToday: boolean): void {
    const details = document.createElement('details');
    details.className = 'day-section';
    if (isToday) details.open = true;

    const summary = document.createElement('summary');
    const divider = document.createElement('div');
    divider.className = 'day-divider';
    divider.innerHTML = `
      <div class="day-divider-line"></div>
      <div class="day-divider-label">${label} — ${dateSubLabel}</div>
      <div class="day-divider-line"></div>
    `;
    summary.appendChild(divider);
    details.appendChild(summary);
    this.el.appendChild(details);
    this.currentSection = details;
  }

  scrollToTop(): void {
    this.el.scrollTop = 0;
  }

  append(msg: Message, scroll = true): void {
    const rawHtml = msg.rawInput
      ? `<div class="msg-raw"><div class="msg-raw-label">Original input</div>${escapeHtml(msg.rawInput)}</div>`
      : '';

    const el = document.createElement('div');
    el.className = 'msg';
    el.innerHTML = `
      <div class="msg-time">${msg.time}</div>
      <div class="msg-body">
        <div class="msg-type ${msg.type}">${msg.typeLabel}</div>
        <div class="msg-content"${msg.entryId ? ' data-editable="true"' : ''}>${msg.content}</div>
        ${rawHtml}
      </div>
    `;

    if (msg.entryId) {
      const contentEl = el.querySelector('.msg-content') as HTMLElement;
      contentEl.addEventListener('click', () => {
        this.startEdit(el, contentEl, msg);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'msg-delete-btn';
      deleteBtn.title = 'Delete entry';
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await execute('DELETE FROM log_entries WHERE id = ?', [msg.entryId!]);
        el.remove();
        this.onSidebarRefresh?.();
      });
      el.appendChild(deleteBtn);
    }

    const container = this.currentSection ?? this.el;
    container.appendChild(el);
    if (scroll) this.el.scrollTop = this.el.scrollHeight;
  }

  private startEdit(msgEl: HTMLElement, contentEl: HTMLElement, msg: Message): void {
    if (msgEl.querySelector('.msg-edit-area')) return;

    const originalHtml = contentEl.innerHTML;
    const fallbackText = contentEl.textContent ?? '';
    contentEl.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'msg-edit-area';
    textarea.value = msg.rawInput ?? fallbackText;
    contentEl.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'msg-edit-actions';
    actions.innerHTML = `
      <button class="msg-edit-save">Save</button>
      <button class="msg-edit-cancel">Cancel</button>
    `;
    contentEl.appendChild(actions);

    textarea.focus();

    actions.querySelector('.msg-edit-cancel')!.addEventListener('click', (e) => {
      e.stopPropagation();
      contentEl.innerHTML = originalHtml;
    });

    actions.querySelector('.msg-edit-save')!.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newText = textarea.value.trim();
      if (!newText || !msg.entryId) return;

      const saveBtn = actions.querySelector('.msg-edit-save') as HTMLButtonElement;
      saveBtn.textContent = '...';
      saveBtn.disabled = true;

      const adapter = await getAdapter();
      let formatted = `<ul><li>${escapeHtml(newText)}</li></ul>`;

      if (adapter) {
        try {
          formatted = await formatLogEntry(newText, adapter);
        } catch {
          // fall through to raw text
        }
      }

      await execute(
        'UPDATE log_entries SET raw_text = ?, formatted_text = ? WHERE id = ?',
        [newText, formatted, msg.entryId]
      );

      msg.rawInput = newText;
      msg.content = formatted;
      contentEl.innerHTML = formatted;
    });
  }
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm test src/__tests__/components/ChatArea.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChatArea.ts src/__tests__/components/ChatArea.test.ts
git commit -m "feat: add collapsible day sections, delete button, and sidebar refresh to ChatArea"
```

---

## Task 7: Sidebar — onDaySelect Callback

**Files:**
- Modify: `src/components/Sidebar.ts`

- [ ] **Step 1: Update Sidebar.ts**

Replace the full file:

```ts
import { query } from '../db.js';
import { escapeHtml } from '../utils.js';
import type { DayStats } from '../types.js';

export class Sidebar {
  private monthLabel: HTMLElement;
  private dayList: HTMLElement;

  constructor(private onDaySelect: (date: string) => void) {
    this.monthLabel = document.getElementById('sidebarMonthLabel')!;
    this.dayList = document.getElementById('dayList')!;
    const now = new Date();
    this.monthLabel.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.load();
  }

  refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const stats = await query<DayStats>(`
      SELECT
        l.date,
        COUNT(l.id) AS log_count,
        (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
        (SELECT raw_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
      FROM log_entries l
      GROUP BY l.date
      ORDER BY l.date DESC
      LIMIT 30
    `);

    this.dayList.innerHTML = '';
    stats.forEach((s, i) => this.dayList.appendChild(this.renderEntry(s, i === 0)));
  }

  private renderEntry(s: DayStats, active: boolean): HTMLElement {
    const d = new Date(s.date + 'T00:00:00');
    const dowNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dow = dowNames[d.getDay()];
    const day = d.getDate();

    const metaTags: string[] = [];
    if (s.log_count > 0) metaTags.push(`<span class="tag tag-log">${s.log_count} entries</span>`);
    if (s.todo_done_count > 0) metaTags.push(`<span class="tag tag-todo">${s.todo_done_count} done</span>`);

    const el = document.createElement('div');
    el.className = `day-entry${active ? ' active' : ''}`;
    el.innerHTML = `
      <div class="day-entry-date">
        <div class="day-entry-dow">${dow}</div>
        <div class="day-entry-num">${day}</div>
      </div>
      <div>
        <div class="day-entry-preview">${escapeHtml(s.preview ?? '')}</div>
        <div class="day-entry-meta">${metaTags.join('')}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      document.querySelectorAll('.day-entry').forEach((e) => e.classList.remove('active'));
      el.classList.add('active');
      this.onDaySelect(s.date);
    });
    return el;
  }
}
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
pnpm test
```

Expected: all existing tests pass. (App.ts still passes `new Sidebar()` with no args — it will error at runtime but not in tests since Sidebar isn't constructed directly in tests. App.ts will be fixed in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.ts
git commit -m "feat: add onDaySelect callback to Sidebar"
```

---

## Task 8: LogModal — openDay() for Day View

**Files:**
- Modify: `src/components/LogModal.ts`

- [ ] **Step 1: Update LogModal.ts to add openDay()**

Replace the full file:

```ts
import { escapeHtml } from '../utils.js';
import type { TodoItem } from '../types.js';

export class LogModal {
  private overlay: HTMLElement;
  private subtitle: HTMLElement;
  private body: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('logModal')!;
    this.subtitle = document.getElementById('modalSubtitle')!;
    this.body = document.getElementById('modalBody')!;

    document.getElementById('modalCloseBtn')!.addEventListener('click', () => this.close());
    document.getElementById('modalFooterCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.close();
    });
  }

  open(entries: { date: string; items: { text: string; time: string }[] }[]): void {
    const now = new Date();
    this.subtitle.textContent = `Log entries — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
    this.body.innerHTML = entries.map((entry) => `
      <div class="log-view-entry">
        <div class="log-view-date">${entry.date}</div>
        ${entry.items.map((item) => `
          <div class="log-view-item">${item.text} <span class="log-view-time">${item.time}</span></div>
        `).join('')}
      </div>
    `).join('');
    this.overlay.classList.add('visible');
  }

  openDay(dateLabel: string, entries: { text: string; time: string }[], todos: TodoItem[]): void {
    this.subtitle.textContent = dateLabel;

    const entriesHtml = entries.length > 0 ? `
      <div class="log-view-entry">
        <div class="log-view-date">Log Entries</div>
        ${entries.map((item) => `
          <div class="log-view-item">${item.text} <span class="log-view-time">${item.time}</span></div>
        `).join('')}
      </div>
    ` : '';

    const todosHtml = todos.length > 0 ? `
      <div class="log-view-entry">
        <div class="log-view-date">Completed Todos</div>
        ${todos.map((t) => `
          <div class="log-view-item">✓ ${escapeHtml(t.text)}</div>
        `).join('')}
      </div>
    ` : '';

    this.body.innerHTML = entriesHtml + todosHtml;
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/LogModal.ts
git commit -m "feat: add openDay() to LogModal for sidebar day-view"
```

---

## Task 9: App.ts — Wire Everything Together

**Files:**
- Modify: `src/app.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts` (FULL_DOM)
- Modify: `src/__tests__/components/SettingsModal.test.ts` (FULL_DOM — already done in Task 1, verify)

- [ ] **Step 1: Update FULL_DOM in TodoPanel.test.ts to include chatDaysInput**

In `TodoPanel.test.ts`, find and replace the settings modal section:

```
    <div id="baseUrlGroup"></div><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
```

With:

```
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" /><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
```

- [ ] **Step 2: Replace src/app.ts with the updated implementation**

```ts
import { initDB, query, execute, getSetting } from './db.js';
import { formatLogEntry } from './ai.js';
import { exportMarkdown } from './export.js';
import { getAdapter } from './llm/factory.js';
import { escapeHtml, stripHtml } from './utils.js';
import type { LogEntry, TodoItem } from './types.js';
import { parseCommand } from './commands.js';
import { LogModal } from './components/LogModal.js';
import { InputHandler } from './components/InputHandler.js';
import { ChatArea } from './components/ChatArea.js';
import { TodoPanel } from './components/TodoPanel.js';
import { Sidebar } from './components/Sidebar.js';
import { SettingsModal } from './components/SettingsModal.js';

class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;
  private settings: SettingsModal;
  private sidebar: Sidebar;
  private inputHandler!: InputHandler;

  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    this.settings = new SettingsModal();
    this.sidebar = new Sidebar((date) => { void this.openDayModal(date); });
    this.chatArea.setSidebarRefresh(() => this.sidebar.refresh());
    this.initHeader();
    this.inputHandler = new InputHandler((value) => this.handleInput(value));
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      const chatDays = parseInt((await getSetting('chat_days')) ?? '3') || 3;
      await Promise.all([this.todoPanel.load(), this.loadRecentEntries(chatDays)]);
      await getAdapter();
    } catch (err) {
      console.error('Startup load failed:', err);
      this.chatArea.append({
        time: '--:--', type: 'system', typeLabel: 'System',
        content: 'Failed to load data. Please restart the app.',
      });
    }
  }

  private async loadRecentEntries(days: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const dateRows = await query<{ date: string }>(
      'SELECT DISTINCT date FROM log_entries ORDER BY date DESC LIMIT ?',
      [days]
    );

    const dates = dateRows.map((r) => r.date);
    if (!dates.includes(today)) dates.push(today);
    dates.sort();

    for (const date of dates) {
      const isToday = date === today;
      const d = new Date(date + 'T00:00:00');
      const diffMs = new Date(today).getTime() - d.getTime();
      const diffDays = Math.round(diffMs / 86400000);
      const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : d.toLocaleString('en-US', { weekday: 'long' });
      const dateSubLabel = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

      this.chatArea.appendDaySection(label, dateSubLabel, isToday);

      const [entries, todos] = await Promise.all([
        query<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC', [date]),
        query<TodoItem>('SELECT * FROM todos WHERE created_at LIKE ? ORDER BY created_at ASC', [date + '%']),
      ]);

      type FeedItem =
        | { created_at: string; kind: 'log'; entry: LogEntry }
        | { created_at: string; kind: 'todo'; todo: TodoItem };

      const items: FeedItem[] = [
        ...entries.map((e) => ({ created_at: e.created_at, kind: 'log' as const, entry: e })),
        ...todos.map((t) => ({ created_at: t.created_at, kind: 'todo' as const, todo: t })),
      ].sort((a, b) => a.created_at.localeCompare(b.created_at));

      for (const item of items) {
        if (item.kind === 'log') {
          const e = item.entry;
          const time = new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          this.chatArea.append({
            time, type: 'log', typeLabel: 'Log entry',
            content: e.formatted_text,
            rawInput: e.raw_text !== e.formatted_text ? e.raw_text : undefined,
            entryId: e.id,
          }, false);
        } else {
          const t = item.todo;
          const time = new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          const typeLabel = t.deadline ? `Todo created — due ${t.deadline}` : 'Todo created';
          this.chatArea.append({ time, type: 'todo-created', typeLabel, content: escapeHtml(t.text) }, false);
        }
      }
    }

    this.chatArea.scrollToTop();
  }

  private async openDayModal(date: string): Promise<void> {
    const d = new Date(date + 'T00:00:00');
    const dateLabel = d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const [entries, todos] = await Promise.all([
      query<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC', [date]),
      query<TodoItem>('SELECT * FROM todos WHERE completed_at LIKE ? ORDER BY completed_at ASC', [date + '%']),
    ]);

    const items = entries.map((e) => ({
      text: stripHtml(e.formatted_text),
      time: new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }));

    this.modal.openDay(dateLabel, items, todos);
  }

  private initHeader(): void {
    const dateEl = document.getElementById('headerDate')!;
    dateEl.textContent = new Date().toLocaleString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    document.getElementById('sidebarToggleBtn')!.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('viewLogBtn')!.addEventListener('click', () => this.openLogModal());
    document.getElementById('settingsBtn')!.addEventListener('click', () => { void this.settings.open(); });
    document.getElementById('exportBtn')!.addEventListener('click', () => { void exportMarkdown(); });
  }

  private toggleSidebar(): void {
    const app = document.getElementById('app')!;
    const btn = document.getElementById('sidebarToggleBtn')!;
    app.classList.toggle('sidebar-collapsed');
    btn.classList.toggle('active');
  }

  private async openLogModal(): Promise<void> {
    const entries = await query<LogEntry>(
      'SELECT * FROM log_entries ORDER BY date DESC, created_at ASC'
    );

    const grouped = new Map<string, { text: string; time: string }[]>();
    for (const e of entries) {
      const time = new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (!grouped.has(e.date)) grouped.set(e.date, []);
      grouped.get(e.date)!.push({ text: stripHtml(e.formatted_text), time });
    }

    const modalData = Array.from(grouped.entries()).map(([date, items]) => {
      const d = new Date(date + 'T00:00:00');
      const label = d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      return { date: label, items };
    });

    this.modal.open(modalData);
  }

  private async handleInput(value: string): Promise<void> {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const cmd = parseCommand(value);

    if (cmd.type === 'todo') {
      await this.todoPanel.add(cmd.text, false, cmd.deadline);
      void this.sidebar.refresh();
      const label = cmd.deadline ? `Todo created — due ${cmd.deadline}` : 'Todo created';
      this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: escapeHtml(cmd.text) });

    } else if (cmd.type === 'done') {
      const found = await this.todoPanel.completeByText(cmd.task);
      void this.sidebar.refresh();
      this.chatArea.append({
        time, type: 'system', typeLabel: 'System',
        content: found
          ? `Marked <span style="color:var(--text)">"${escapeHtml(cmd.task)}"</span> as complete.`
          : `No active todo matching "${escapeHtml(cmd.task)}" found.`,
      });

    } else if (cmd.type === 'important') {
      await this.todoPanel.add(cmd.text, true, null);
      void this.sidebar.refresh();
      this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: escapeHtml(cmd.text) });

    } else if (cmd.type === 'log') {
      const today = new Date().toISOString().split('T')[0];
      const adapter = await getAdapter();

      let formatted = `<ul><li>${escapeHtml(cmd.text)}</li></ul>`;

      if (adapter) {
        this.inputHandler.setLoading(true);
        try {
          formatted = await formatLogEntry(cmd.text, adapter);
        } catch (err) {
          console.error('AI format failed:', err);
          this.chatArea.append({
            time, type: 'system', typeLabel: 'System',
            content: 'AI formatting failed — saved raw text.',
          });
        } finally {
          this.inputHandler.setLoading(false);
        }
      }

      await execute(
        'INSERT INTO log_entries (date, raw_text, formatted_text, created_at) VALUES (?, ?, ?, ?)',
        [today, cmd.text, formatted, new Date().toISOString()]
      );

      const rows = await query<{ id: number }>(
        'SELECT id FROM log_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1',
        [today]
      );

      this.chatArea.append({
        time, type: 'log', typeLabel: 'Log entry',
        content: formatted,
        rawInput: cmd.text,
        entryId: rows[0]?.id,
      });

      void this.sidebar.refresh();
    }
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  new App();
});
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: wire multi-day feed, day modal, and sidebar callbacks in App"
```

---

## Task 10: CSS — All New Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add styles to the end of src/styles.css**

Append the following:

```css
/* ── Day section collapsible ── */
details.day-section { width: 100%; }
details.day-section > summary {
  cursor: pointer;
  list-style: none;
  display: block;
}
details.day-section > summary::-webkit-details-marker { display: none; }

details.day-section > summary .day-divider-label::before {
  content: '▶ ';
  font-size: 0.65em;
  opacity: 0.5;
  margin-right: 2px;
}
details.day-section[open] > summary .day-divider-label::before {
  content: '▼ ';
}

/* ── Log entry delete button ── */
.msg { position: relative; }
.msg-delete-btn {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: none;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
}
.msg-delete-btn:hover { color: var(--red); background: var(--red-dim); }
.msg:hover .msg-delete-btn { display: block; }

/* ── Todo inline edit ── */
.todo-edit-area {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-hover);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 6px;
  resize: none;
  min-height: 2.5rem;
}
.todo-edit-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.3rem;
}
.todo-edit-save, .todo-edit-cancel {
  background: none;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 2px 8px;
}
.todo-edit-save:hover { color: var(--accent); border-color: var(--accent); }
.todo-edit-cancel:hover { color: var(--text); border-color: var(--border-hover); }

/* ── Todo archive section ── */
details.todo-archive { width: 100%; margin-top: 0.25rem; }
details.todo-archive > summary.todo-archive-summary {
  cursor: pointer;
  list-style: none;
  display: block;
}
details.todo-archive > summary::-webkit-details-marker { display: none; }
details.todo-archive > summary.todo-archive-summary {
  color: var(--text-dim);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 6px 0 4px;
}
details.todo-archive > summary.todo-archive-summary::before {
  content: '▶ ';
  font-size: 0.6em;
  opacity: 0.6;
}
details.todo-archive[open] > summary.todo-archive-summary::before {
  content: '▼ ';
}

/* ── Completed todo checkmark hover ── */
.todo-item.completed .todo-check:hover {
  opacity: 0.6;
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add styles for day sections, delete button, todo edit, and archive"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Delete log entry via hover ✕ | Task 6 (ChatArea delete btn) + Task 9 (App wiring) |
| Sidebar day click → modal with log + completed todos | Task 7 (Sidebar) + Task 8 (LogModal) + Task 9 (App openDayModal) |
| Multi-day chat feed, past days collapsible, today on top | Task 6 (ChatArea sections) + Task 9 (App loadRecentEntries) |
| chat_days configurable in settings | Task 1 |
| Uncheck completed todo | Task 3 |
| Inline edit todo text | Task 4 |
| Todo persistence across restarts | Task 9 (loadRecentEntries merges todos) |
| Archive for completed todos > 7 days | Task 2 (todoLogic) + Task 5 (render) |
| DB migration for chat_days | Task 1 |

All spec requirements covered. ✓

**Type consistency:**
- `TodoSection` type exported from `todoLogic.ts` in Task 2 — used implicitly in `TodoPanel.ts` Task 5 via `getTodoSections()` return type. The `collapsed` field is accessed via `section.collapsed` in Task 5, matching the definition. ✓
- `ChatArea.append(msg, scroll?)` — second param added in Task 6, used with `false` in Task 9. ✓
- `Sidebar` constructor takes `onDaySelect` in Task 7, called with a callback in Task 9. ✓
- `LogModal.openDay(dateLabel, entries, todos)` defined in Task 8, called with matching signature in Task 9. ✓

**No placeholders:** All steps contain actual code. ✓
