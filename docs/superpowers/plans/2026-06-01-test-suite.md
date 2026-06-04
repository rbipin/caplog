# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Completed

**Goal:** Add a Vitest + jsdom test suite covering all pure logic, LLM adapters, db wrapper, export, and UI components.

**Architecture:** Extract pure logic and UI components out of `main.ts` into focused modules so each can be imported and tested in isolation. Mock all Tauri plugins with `vi.mock`. UI component tests set up a jsdom DOM fixture before instantiating each class.

**Tech Stack:** Vitest, jsdom, @vitest/coverage-v8, TypeScript

---

## File Map

**New source files:**
- `src/types.ts` — shared interfaces (TodoItem, LogEntry, DayStats, Message, MessageType)
- `src/utils.ts` — escapeHtml, stripHtml
- `src/commands.ts` — parseCommand + ParsedCommand discriminated union
- `src/todoLogic.ts` — todoStatus, getTodoSections
- `src/components/TodoPanel.ts` — TodoPanel class
- `src/components/ChatArea.ts` — ChatArea class
- `src/components/SettingsModal.ts` — SettingsModal class

**New test files:**
- `src/__tests__/utils.test.ts`
- `src/__tests__/commands.test.ts`
- `src/__tests__/todoLogic.test.ts`
- `src/__tests__/db.test.ts`
- `src/__tests__/ai.test.ts`
- `src/__tests__/export.test.ts`
- `src/__tests__/llm/anthropic.test.ts`
- `src/__tests__/llm/openai.test.ts`
- `src/__tests__/llm/factory.test.ts`
- `src/__tests__/components/TodoPanel.test.ts`
- `src/__tests__/components/SettingsModal.test.ts`
- `src/__tests__/components/ChatArea.test.ts`

**Modified files:**
- `package.json` — add devDeps and test scripts
- `vitest.config.ts` — new config file (separate from vite.config.ts)
- `src/main.ts` — remove extracted code, add imports

---

## Task 1: Install Vitest and configure the test environment

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add -D vitest jsdom @vitest/coverage-v8
```

- [ ] **Step 2: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: { provider: 'v8', include: ['src/**'] },
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Verify setup runs without error**

```bash
pnpm test
```

Expected: `No test files found` (or similar — no failures, just no tests yet)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add vitest + jsdom test framework"
```

---

## Task 2: Extract shared types to src/types.ts

**Files:**
- Create: `src/types.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/types.ts**

```ts
export interface TodoItem {
  id: number;
  text: string;
  is_important: number;
  is_completed: number;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
}

export type MessageType = 'log' | 'todo-created' | 'system';

export interface Message {
  time: string;
  type: MessageType;
  typeLabel: string;
  content: string;
  rawInput?: string;
  entryId?: number;
}

export interface LogEntry {
  id: number;
  date: string;
  raw_text: string;
  formatted_text: string;
  created_at: string;
}

export interface DayStats {
  date: string;
  log_count: number;
  todo_done_count: number;
  preview: string;
}
```

- [ ] **Step 2: Replace the type definitions in src/main.ts**

Remove the `TodoItem`, `MessageType`, `Message`, `LogEntry`, `DayStats` definitions (lines 24–58) and add this import at the top of the imports block:

```ts
import type { TodoItem, Message, LogEntry, DayStats } from './types.js';
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/main.ts
git commit -m "refactor: extract shared types to src/types.ts"
```

---

## Task 3: Extract utilities and write tests

**Files:**
- Create: `src/utils.ts`
- Create: `src/__tests__/utils.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { escapeHtml, stripHtml } from '../utils.js';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });
  it('escapes less-than', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });
  it('escapes greater-than', () => {
    expect(escapeHtml('1 > 0')).toBe('1 &gt; 0');
  });
  it('escapes double quote', () => {
    expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;');
  });
  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('stripHtml', () => {
  it('returns text content of a simple tag', () => {
    expect(stripHtml('<b>bold</b>')).toBe('bold');
  });
  it('handles nested tags and returns flattened text', () => {
    expect(stripHtml('<ul><li>a</li><li>b</li></ul>')).toBe('ab');
  });
  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test src/__tests__/utils.test.ts
```

Expected: FAIL — `Cannot find module '../utils.js'`

- [ ] **Step 3: Create src/utils.ts**

```ts
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}
```

- [ ] **Step 4: Update src/main.ts**

Remove the `escapeHtml` and `stripHtml` function definitions (lines 8–19). Add this import:

```ts
import { escapeHtml, stripHtml } from './utils.js';
```

- [ ] **Step 5: Run tests and confirm they pass**

```bash
pnpm test src/__tests__/utils.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 6: Verify the build still compiles**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils.ts src/__tests__/utils.test.ts src/main.ts
git commit -m "refactor: extract utils.ts; add escapeHtml/stripHtml tests"
```

---

## Task 4: Extract command parsing and write tests

**Files:**
- Create: `src/commands.ts`
- Create: `src/__tests__/commands.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/commands.test.ts
import { describe, it, expect } from 'vitest';
import { parseCommand } from '../commands.js';

describe('parseCommand', () => {
  it('parses /todo with no deadline', () => {
    expect(parseCommand('/todo Buy milk')).toEqual({ type: 'todo', text: 'Buy milk', deadline: null });
  });
  it('parses /todo with /by deadline', () => {
    expect(parseCommand('/todo Buy milk /by 2026-06-10')).toEqual({
      type: 'todo', text: 'Buy milk', deadline: '2026-06-10',
    });
  });
  it('returns empty for /todo with no text', () => {
    expect(parseCommand('/todo')).toEqual({ type: 'empty' });
    expect(parseCommand('/todo   ')).toEqual({ type: 'empty' });
  });
  it('parses /done', () => {
    expect(parseCommand('/done fix bug')).toEqual({ type: 'done', task: 'fix bug' });
  });
  it('parses /important', () => {
    expect(parseCommand('/important Fix the bug')).toEqual({ type: 'important', text: 'Fix the bug' });
  });
  it('parses plain text as log', () => {
    expect(parseCommand('worked on auth')).toEqual({ type: 'log', text: 'worked on auth' });
  });
  it('returns empty for whitespace-only input', () => {
    expect(parseCommand('   ')).toEqual({ type: 'empty' });
  });
  it('trims leading whitespace before command', () => {
    expect(parseCommand('  /todo Buy milk')).toEqual({ type: 'todo', text: 'Buy milk', deadline: null });
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test src/__tests__/commands.test.ts
```

Expected: FAIL — `Cannot find module '../commands.js'`

- [ ] **Step 3: Create src/commands.ts**

```ts
export type ParsedCommand =
  | { type: 'log'; text: string }
  | { type: 'todo'; text: string; deadline: string | null }
  | { type: 'important'; text: string }
  | { type: 'done'; task: string }
  | { type: 'empty' };

export function parseCommand(input: string): ParsedCommand {
  const value = input.trim();
  if (!value) return { type: 'empty' };

  if (value.startsWith('/todo')) {
    const rest = value.replace('/todo', '').trim();
    if (!rest) return { type: 'empty' };
    const byIdx = rest.indexOf(' /by ');
    if (byIdx !== -1) {
      return {
        type: 'todo',
        text: rest.slice(0, byIdx).trim(),
        deadline: rest.slice(byIdx + 5).trim(),
      };
    }
    return { type: 'todo', text: rest, deadline: null };
  }

  if (value.startsWith('/done')) {
    return { type: 'done', task: value.replace('/done', '').trim() };
  }

  if (value.startsWith('/important')) {
    return { type: 'important', text: value.replace('/important', '').trim() };
  }

  return { type: 'log', text: value };
}
```

- [ ] **Step 4: Update App.handleInput in src/main.ts**

Add this import:

```ts
import { parseCommand, type ParsedCommand } from './commands.js';
```

Replace the body of `App.handleInput` (the `if (value.startsWith('/todo'))` block) with:

```ts
private async handleInput(value: string): Promise<void> {
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const cmd = parseCommand(value);

  if (cmd.type === 'empty') return;

  if (cmd.type === 'todo') {
    if (!cmd.text) return;
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

  } else {
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
```

- [ ] **Step 5: Run the command tests and confirm they pass**

```bash
pnpm test src/__tests__/commands.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 6: Verify build**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/commands.ts src/__tests__/commands.test.ts src/main.ts
git commit -m "refactor: extract command parsing; add parseCommand tests"
```

---

## Task 5: Extract todo logic and write tests

**Files:**
- Create: `src/todoLogic.ts`
- Create: `src/__tests__/todoLogic.test.ts`
- Modify: `src/main.ts` (TodoPanel.render and TodoPanel.renderItem)

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/todoLogic.test.ts
import { describe, it, expect } from 'vitest';
import { todoStatus, getTodoSections } from '../todoLogic.js';
import type { TodoItem } from '../types.js';

const base: TodoItem = {
  id: 1,
  text: 'Test',
  is_important: 0,
  is_completed: 0,
  deadline: null,
  created_at: '2026-01-01T00:00:00Z',
  completed_at: null,
};

describe('todoStatus', () => {
  it('returns completed for completed todo', () => {
    expect(todoStatus({ ...base, is_completed: 1 })).toBe('completed');
  });
  it('returns important for important incomplete todo', () => {
    expect(todoStatus({ ...base, is_important: 1 })).toBe('important');
  });
  it('returns overdue for past deadline', () => {
    expect(todoStatus({ ...base, deadline: '2020-01-01' })).toBe('overdue');
  });
  it('returns open when no deadline, not important, not completed', () => {
    expect(todoStatus(base)).toBe('open');
  });
  it('completed takes precedence over important', () => {
    expect(todoStatus({ ...base, is_completed: 1, is_important: 1 })).toBe('completed');
  });
});

describe('getTodoSections', () => {
  it('Important section excludes completed items', () => {
    const { filter } = getTodoSections().find(s => s.label === 'Important')!;
    expect(filter({ ...base, is_important: 1, is_completed: 1 })).toBe(false);
    expect(filter({ ...base, is_important: 1, is_completed: 0 })).toBe(true);
  });
  it('Due/Overdue section excludes important items', () => {
    const { filter } = getTodoSections().find(s => s.label === 'Due / Overdue')!;
    expect(filter({ ...base, is_important: 1, deadline: '2020-01-01' })).toBe(false);
    expect(filter({ ...base, is_important: 0, deadline: '2020-01-01' })).toBe(true);
  });
  it('Open section excludes items with past deadline', () => {
    const { filter } = getTodoSections().find(s => s.label === 'Open')!;
    expect(filter({ ...base, deadline: '2020-01-01' })).toBe(false);
    expect(filter({ ...base, deadline: null })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test src/__tests__/todoLogic.test.ts
```

Expected: FAIL — `Cannot find module '../todoLogic.js'`

- [ ] **Step 3: Create src/todoLogic.ts**

```ts
import type { TodoItem } from './types.js';

export type TodoStatus = 'completed' | 'important' | 'overdue' | 'open';

export function todoStatus(todo: TodoItem): TodoStatus {
  if (todo.is_completed) return 'completed';
  if (todo.is_important) return 'important';
  if (todo.deadline) {
    const today = new Date().toISOString().split('T')[0];
    if (todo.deadline <= today) return 'overdue';
  }
  return 'open';
}

export function getTodoSections(): { label: string; filter: (t: TodoItem) => boolean }[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    { label: 'Important',       filter: (t) => !t.is_completed && !!t.is_important },
    { label: 'Due / Overdue',   filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
    { label: 'Open',            filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
    { label: 'Completed today', filter: (t) => !!t.is_completed },
  ];
}
```

- [ ] **Step 4: Update TodoPanel in src/main.ts**

Add this import:

```ts
import { todoStatus, getTodoSections } from './todoLogic.js';
```

In `TodoPanel.renderItem`, replace `const status = this.todoStatus(todo);` with:

```ts
const status = todoStatus(todo);
```

Remove the private `todoStatus` method from the `TodoPanel` class entirely.

In `TodoPanel.render`, replace the inline `sections` array and `today` variable with:

```ts
const sections = getTodoSections();
```

(Remove the `const today = ...` line too — it is now internal to `getTodoSections`.)

- [ ] **Step 5: Run tests and confirm they pass**

```bash
pnpm test src/__tests__/todoLogic.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 6: Verify build**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/todoLogic.ts src/__tests__/todoLogic.test.ts src/main.ts
git commit -m "refactor: extract todo logic; add todoStatus/getTodoSections tests"
```

---

## Task 6: Extract UI components to src/components/

This is required so component tests can import individual classes without running the full app bootstrap. `TodoPanel`, `ChatArea`, and `SettingsModal` move to their own files; `main.ts` imports them.

**Files:**
- Create: `src/components/TodoPanel.ts`
- Create: `src/components/ChatArea.ts`
- Create: `src/components/SettingsModal.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/components/TodoPanel.ts**

Copy the entire `TodoPanel` class from `main.ts` into this new file, then update its imports:

```ts
import { query, execute } from '../db.js';
import type { TodoItem } from '../types.js';
import { escapeHtml } from '../utils.js';
import { todoStatus, getTodoSections } from '../todoLogic.js';

export class TodoPanel {
  private listEl: HTMLElement;
  private countEl: HTMLElement;

  constructor() {
    this.listEl = document.getElementById('todoList')!;
    this.countEl = document.getElementById('todoCount')!;
  }

  async load(): Promise<void> {
    const todos = await query<TodoItem>(
      'SELECT * FROM todos ORDER BY is_important DESC, CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at ASC'
    );
    this.render(todos);
  }

  async add(text: string, isImportant = false, deadline: string | null = null): Promise<void> {
    await execute(
      'INSERT INTO todos (text, is_important, deadline, created_at) VALUES (?, ?, ?, ?)',
      [text, isImportant ? 1 : 0, deadline, new Date().toISOString()]
    );
    await this.load();
  }

  async complete(id: number): Promise<void> {
    await execute(
      'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    await this.load();
  }

  async completeByText(text: string): Promise<boolean> {
    const escaped = text.replace(/[%_\\]/g, '\\$&');
    const rows = await query<TodoItem>(
      "SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?) ESCAPE '\\'",
      [`%${escaped}%`]
    );
    if (rows.length === 0) return false;
    await this.complete(rows[0].id);
    return true;
  }

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM todos WHERE id = ?', [id]);
    await this.load();
  }

  private renderItem(todo: TodoItem): HTMLElement {
    const status = todoStatus(todo);
    const el = document.createElement('div');
    el.className = `todo-item${status !== 'open' ? ` ${status}` : ''}`;
    el.dataset.id = String(todo.id);

    const checkInner = status === 'completed' ? '<span class="completed-check">✓</span>' : '';

    const metaHtml = (() => {
      const parts: string[] = [];
      if (todo.deadline) {
        parts.push(`<span class="todo-deadline${status === 'overdue' ? ' overdue' : ''}">${escapeHtml(todo.deadline)}</span>`);
      }
      if (status === 'important') {
        parts.push('<span class="todo-badge important">important</span>');
      } else if (status === 'overdue') {
        parts.push('<span class="todo-badge overdue">due soon</span>');
      }
      return parts.length ? `<div class="todo-meta">${parts.join('')}</div>` : '';
    })();

    el.innerHTML = `
      <div class="todo-check">${checkInner}</div>
      <div style="flex:1">
        <div class="todo-text">${escapeHtml(todo.text)}</div>
        ${metaHtml}
      </div>
      <button class="todo-delete-btn" title="Delete">✕</button>
    `;

    if (status !== 'completed') {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.todo-delete-btn')) return;
        void this.complete(todo.id);
      });
    }

    el.querySelector('.todo-delete-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.delete(todo.id);
    });

    return el;
  }

  render(todos: TodoItem[]): void {
    this.listEl.innerHTML = '';
    const sections = getTodoSections();

    for (const section of sections) {
      const items = todos.filter(section.filter);
      if (items.length === 0) continue;

      const label = document.createElement('div');
      label.className = 'todo-section-label';
      label.textContent = section.label;
      this.listEl.appendChild(label);

      for (const item of items) {
        this.listEl.appendChild(this.renderItem(item));
      }
    }

    const open = todos.filter((t) => !t.is_completed).length;
    const done = todos.filter((t) => t.is_completed).length;
    this.countEl.textContent = `${open} open · ${done} done`;
  }
}
```

Note: `render` is changed from `private` to `public` (no `private` keyword) so tests can call it directly.

- [ ] **Step 2: Create src/components/ChatArea.ts**

```ts
import type { Message, LogEntry } from '../types.js';
import { escapeHtml } from '../utils.js';
import { execute } from '../db.js';
import { formatLogEntry } from '../ai.js';
import { getAdapter } from '../llm/factory.js';

export class ChatArea {
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById('chatArea')!;
    this.appendDivider('Today');
  }

  loadEntries(entries: LogEntry[]): void {
    for (const entry of entries) {
      const time = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      this.append({
        time,
        type: 'log',
        typeLabel: 'Log entry',
        content: entry.formatted_text,
        rawInput: entry.raw_text !== entry.formatted_text ? entry.raw_text : undefined,
        entryId: entry.id,
      });
    }
  }

  appendDivider(label: string): void {
    const now = new Date();
    const shortDate = now.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    const el = document.createElement('div');
    el.className = 'day-divider';
    el.innerHTML = `
      <div class="day-divider-line"></div>
      <div class="day-divider-label">${label} — ${shortDate}</div>
      <div class="day-divider-line"></div>
    `;
    this.el.appendChild(el);
  }

  append(msg: Message): void {
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
    }

    this.el.appendChild(el);
    this.el.scrollTop = this.el.scrollHeight;
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

    actions.querySelector('.msg-edit-cancel')!.addEventListener('click', () => {
      contentEl.innerHTML = originalHtml;
    });

    actions.querySelector('.msg-edit-save')!.addEventListener('click', async () => {
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

- [ ] **Step 3: Create src/components/SettingsModal.ts**

```ts
import { getSetting, setSetting, execute } from '../db.js';

export class SettingsModal {
  private overlay: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private baseUrlInput: HTMLInputElement;
  private baseUrlGroup: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.providerSelect = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.modelInput = document.getElementById('llmModelInput') as HTMLInputElement;
    this.baseUrlInput = document.getElementById('llmBaseUrlInput') as HTMLInputElement;
    this.baseUrlGroup = document.getElementById('baseUrlGroup')!;

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
    const [provider, apiKey, model, baseUrl] = await Promise.all([
      getSetting('llm_provider'),
      getSetting('llm_api_key'),
      getSetting('llm_model'),
      getSetting('llm_base_url'),
    ]);

    this.providerSelect.value = provider ?? 'anthropic';
    this.apiKeyInput.value = apiKey ?? '';
    this.modelInput.value = model ?? '';
    this.baseUrlInput.value = baseUrl ?? '';
    this.syncBaseUrlVisibility();
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  async save(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      await Promise.all([
        execute('DELETE FROM settings WHERE key = ?', ['llm_provider']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_api_key']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_model']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_base_url']),
      ]);
      this.close();
      return;
    }

    const provider = this.providerSelect.value;
    const model = this.modelInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();

    if (!model) {
      alert('Please enter a model name.');
      return;
    }

    await setSetting('llm_provider', provider);
    await setSetting('llm_api_key', apiKey);
    await setSetting('llm_model', model);
    await setSetting('llm_base_url', provider === 'openai' ? baseUrl : '');

    this.close();
  }
}
```

- [ ] **Step 4: Update src/main.ts to import the three components and remove their definitions**

Remove the `TodoPanel`, `ChatArea`, and `SettingsModal` class bodies from `main.ts`. Add these imports:

```ts
import { TodoPanel } from './components/TodoPanel.js';
import { ChatArea } from './components/ChatArea.js';
import { SettingsModal } from './components/SettingsModal.js';
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

Expected: no errors. If TypeScript reports `noUnusedLocals` errors in main.ts for things the components now own, remove those imports from main.ts.

- [ ] **Step 6: Run all existing tests to confirm nothing regressed**

```bash
pnpm test
```

Expected: all previously passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ src/main.ts
git commit -m "refactor: extract TodoPanel, ChatArea, SettingsModal to src/components/"
```

---

## Task 7: Tests for LLM adapters

**Files:**
- Create: `src/__tests__/llm/anthropic.test.ts`
- Create: `src/__tests__/llm/openai.test.ts`

- [ ] **Step 1: Write AnthropicAdapter tests**

```ts
// src/__tests__/llm/anthropic.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAdapter } from '../../llm/anthropic.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnthropicAdapter', () => {
  const adapter = new AnthropicAdapter('test-key', 'claude-test');

  it('returns trimmed text from successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: '  hello  ' }] }),
    });
    expect(await adapter.complete('sys', 'user')).toBe('hello');
  });

  it('sends correct URL, headers, and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'ok' }] }),
    });
    await adapter.complete('system prompt', 'user input');
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(opts.body as string);
    expect(body.system).toBe('system prompt');
    expect(body.messages[0].content).toBe('user input');
    expect(body.model).toBe('claude-test');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(adapter.complete('sys', 'user')).rejects.toThrow('401');
  });

  it('throws when content array is missing from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await expect(adapter.complete('sys', 'user')).rejects.toThrow('Empty response');
  });
});
```

- [ ] **Step 2: Run AnthropicAdapter tests**

```bash
pnpm test src/__tests__/llm/anthropic.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Write OpenAIAdapter tests**

```ts
// src/__tests__/llm/openai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIAdapter } from '../../llm/openai.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpenAIAdapter', () => {
  it('returns trimmed text from successful response', async () => {
    const adapter = new OpenAIAdapter('key', 'https://api.example.com', 'gpt-4');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '  result  ' } }] }),
    });
    expect(await adapter.complete('sys', 'user')).toBe('result');
  });

  it('strips trailing slash from baseUrl', async () => {
    const adapter = new OpenAIAdapter('key', 'https://api.example.com/', 'gpt-4');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
    });
    await adapter.complete('sys', 'user');
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
  });

  it('throws on HTTP error', async () => {
    const adapter = new OpenAIAdapter('key', 'https://api.example.com', 'gpt-4');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(adapter.complete('sys', 'user')).rejects.toThrow('500');
  });

  it('throws when choices array is missing from response', async () => {
    const adapter = new OpenAIAdapter('key', 'https://api.example.com', 'gpt-4');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await expect(adapter.complete('sys', 'user')).rejects.toThrow('Empty response');
  });
});
```

- [ ] **Step 4: Run OpenAIAdapter tests**

```bash
pnpm test src/__tests__/llm/openai.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/llm/
git commit -m "test: add AnthropicAdapter and OpenAIAdapter tests"
```

---

## Task 8: Tests for ai.ts and getAdapter factory

**Files:**
- Create: `src/__tests__/ai.test.ts`
- Create: `src/__tests__/llm/factory.test.ts`

- [ ] **Step 1: Write ai.ts tests**

```ts
// src/__tests__/ai.test.ts
import { describe, it, expect, vi } from 'vitest';
import { formatLogEntry } from '../ai.js';
import type { LLMAdapter } from '../llm/adapter.js';

const SYSTEM_PROMPT = "Clean up and format the user's text into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points as HTML <ul><li>...</li></ul> with no preamble or explanation.";

describe('formatLogEntry', () => {
  it('calls adapter.complete with the correct system prompt and raw text', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockResolvedValue('<ul><li>Done</li></ul>') };
    await formatLogEntry('did stuff', adapter);
    expect(adapter.complete).toHaveBeenCalledWith(SYSTEM_PROMPT, 'did stuff');
  });

  it('returns trimmed result from adapter', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockResolvedValue('  <ul><li>Done</li></ul>  ') };
    expect(await formatLogEntry('did stuff', adapter)).toBe('<ul><li>Done</li></ul>');
  });

  it('propagates errors thrown by adapter', async () => {
    const adapter: LLMAdapter = { complete: vi.fn().mockRejectedValue(new Error('API down')) };
    await expect(formatLogEntry('text', adapter)).rejects.toThrow('API down');
  });
});
```

- [ ] **Step 2: Run ai.ts tests**

```bash
pnpm test src/__tests__/ai.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Write factory tests**

```ts
// src/__tests__/llm/factory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn().mockResolvedValue(undefined),
}));

import { getSetting, setSetting, execute } from '../../db.js';
import { getAdapter } from '../../llm/factory.js';
import { AnthropicAdapter } from '../../llm/anthropic.js';
import { OpenAIAdapter } from '../../llm/openai.js';

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);
const mockExecute = vi.mocked(execute);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAdapter', () => {
  it('returns null when no provider or legacy key set', async () => {
    mockGetSetting.mockResolvedValue(null);
    expect(await getAdapter()).toBeNull();
  });

  it('returns AnthropicAdapter when provider is anthropic', async () => {
    mockGetSetting
      .mockResolvedValueOnce(null)                     // anthropic_api_key
      .mockResolvedValueOnce('anthropic')               // llm_provider
      .mockResolvedValueOnce('sk-test')                 // llm_api_key
      .mockResolvedValueOnce('claude-haiku-4-5-20251001'); // llm_model
    expect(await getAdapter()).toBeInstanceOf(AnthropicAdapter);
  });

  it('returns OpenAIAdapter when provider is openai with baseUrl', async () => {
    mockGetSetting
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('sk-test')
      .mockResolvedValueOnce('gpt-4')
      .mockResolvedValueOnce('https://api.example.com');
    expect(await getAdapter()).toBeInstanceOf(OpenAIAdapter);
  });

  it('returns null when openai set but no baseUrl', async () => {
    mockGetSetting
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('sk-test')
      .mockResolvedValueOnce('gpt-4')
      .mockResolvedValueOnce(null);
    expect(await getAdapter()).toBeNull();
  });

  it('migrates legacy anthropic_api_key and returns AnthropicAdapter', async () => {
    mockGetSetting
      .mockResolvedValueOnce('old-key')  // anthropic_api_key exists
      .mockResolvedValueOnce(null)        // llm_provider not yet set → triggers migration
      .mockResolvedValueOnce('old-key')  // llm_api_key (read after migration)
      .mockResolvedValueOnce(null);       // llm_model (falls back to default)
    const adapter = await getAdapter();
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    expect(mockSetSetting).toHaveBeenCalledWith('llm_provider', 'anthropic');
    expect(mockSetSetting).toHaveBeenCalledWith('llm_api_key', 'old-key');
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?', ['anthropic_api_key']);
  });
});
```

- [ ] **Step 4: Run factory tests**

```bash
pnpm test src/__tests__/llm/factory.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/ai.test.ts src/__tests__/llm/factory.test.ts
git commit -m "test: add formatLogEntry and getAdapter factory tests"
```

---

## Task 9: Tests for db.ts

**Files:**
- Create: `src/__tests__/db.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/__tests__/db.test.ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue(mockDb),
  },
}));

import { initDB, query, execute, getSetting, setSetting } from '../db.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockResolvedValue([]);
  mockDb.execute.mockResolvedValue(undefined);
});

describe('before initDB', () => {
  it('query throws DB not initialized', async () => {
    await expect(query('SELECT 1', [])).rejects.toThrow('DB not initialized');
  });
  it('execute throws DB not initialized', async () => {
    await expect(execute('SELECT 1', [])).rejects.toThrow('DB not initialized');
  });
});

describe('after initDB', () => {
  beforeAll(async () => {
    await initDB();
  });

  it('query delegates to db.select with correct sql and params', async () => {
    mockDb.select.mockResolvedValueOnce([{ id: 1 }]);
    const result = await query<{ id: number }>('SELECT * FROM test', [1]);
    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM test', [1]);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('execute delegates to db.execute', async () => {
    await execute('INSERT INTO test VALUES (?)', [42]);
    expect(mockDb.execute).toHaveBeenCalledWith('INSERT INTO test VALUES (?)', [42]);
  });

  it('getSetting returns value when row found', async () => {
    mockDb.select.mockResolvedValueOnce([{ value: 'my-value' }]);
    expect(await getSetting('my-key')).toBe('my-value');
  });

  it('getSetting returns null when no rows', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    expect(await getSetting('missing')).toBeNull();
  });

  it('setSetting calls execute with upsert SQL', async () => {
    await setSetting('k', 'v');
    expect(mockDb.execute).toHaveBeenCalledWith(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['k', 'v'],
    );
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test src/__tests__/db.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/db.test.ts
git commit -m "test: add db.ts tests"
```

---

## Task 10: Tests for export.ts

**Files:**
- Create: `src/__tests__/export.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/__tests__/export.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db.js', () => ({
  query: vi.fn(),
}));

import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { query } from '../db.js';
import { exportMarkdown } from '../export.js';

const mockSave = vi.mocked(save);
const mockWriteTextFile = vi.mocked(writeTextFile);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.clearAllMocks();
  mockSave.mockResolvedValue('/tmp/export.md');
  mockWriteTextFile.mockResolvedValue(undefined);
});

describe('exportMarkdown', () => {
  it('groups entries by date with markdown headings', async () => {
    mockQuery.mockResolvedValueOnce([
      { date: '2026-06-01', formatted_text: '<ul><li>Did work</li></ul>', created_at: '2026-06-01T09:00:00Z' },
      { date: '2026-05-31', formatted_text: '<ul><li>Other work</li></ul>', created_at: '2026-05-31T10:00:00Z' },
    ]);
    await exportMarkdown();
    const md = mockWriteTextFile.mock.calls[0][1] as string;
    expect(md).toContain('## ');
    expect(md).toContain('Did work');
    expect(md).toContain('Other work');
  });

  it('strips HTML tags from formatted_text', async () => {
    mockQuery.mockResolvedValueOnce([
      { date: '2026-06-01', formatted_text: '<ul><li>Plain text</li></ul>', created_at: '2026-06-01T09:00:00Z' },
    ]);
    await exportMarkdown();
    const md = mockWriteTextFile.mock.calls[0][1] as string;
    expect(md).not.toContain('<ul>');
    expect(md).toContain('Plain text');
  });

  it('calls writeTextFile when save returns a path', async () => {
    mockQuery.mockResolvedValueOnce([]);
    mockSave.mockResolvedValueOnce('/tmp/out.md');
    await exportMarkdown();
    expect(mockWriteTextFile).toHaveBeenCalledWith('/tmp/out.md', expect.any(String));
  });

  it('does not call writeTextFile when save returns null', async () => {
    mockQuery.mockResolvedValueOnce([]);
    mockSave.mockResolvedValueOnce(null);
    await exportMarkdown();
    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test src/__tests__/export.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/export.test.ts
git commit -m "test: add export.ts tests"
```

---

## Task 11: Tests for TodoPanel

**Files:**
- Create: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/__tests__/components/TodoPanel.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({
  query: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue(undefined),
}));

import { query, execute } from '../../db.js';
import { TodoPanel } from '../../components/TodoPanel.js';
import type { TodoItem } from '../../types.js';

const mockQuery = vi.mocked(query);
const mockExecute = vi.mocked(execute);

const base: TodoItem = {
  id: 1,
  text: 'Test task',
  is_important: 0,
  is_completed: 0,
  deadline: null,
  created_at: '2026-01-01T00:00:00Z',
  completed_at: null,
};

beforeEach(() => {
  document.body.innerHTML = `
    <div id="todoList"></div>
    <div id="todoCount"></div>
  `;
  vi.clearAllMocks();
  mockQuery.mockResolvedValue([]);
  mockExecute.mockResolvedValue(undefined);
});

describe('TodoPanel', () => {
  it('add() inserts a todo and reloads', async () => {
    const panel = new TodoPanel();
    await panel.add('New task');
    expect(mockExecute).toHaveBeenCalledWith(
      'INSERT INTO todos (text, is_important, deadline, created_at) VALUES (?, ?, ?, ?)',
      expect.arrayContaining(['New task', 0, null]),
    );
    expect(mockQuery).toHaveBeenCalled();
  });

  it('add() with isImportant=true passes 1 for is_important', async () => {
    const panel = new TodoPanel();
    await panel.add('Urgent', true, null);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['Urgent', 1]),
    );
  });

  it('complete() updates is_completed to 1 for the given id', async () => {
    const panel = new TodoPanel();
    await panel.complete(42);
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
      expect.arrayContaining([42]),
    );
  });

  it('completeByText returns false when no matching todo found', async () => {
    const panel = new TodoPanel();
    mockQuery.mockResolvedValueOnce([]);
    expect(await panel.completeByText('nonexistent')).toBe(false);
  });

  it('completeByText completes matching todo and returns true', async () => {
    const panel = new TodoPanel();
    mockQuery
      .mockResolvedValueOnce([{ ...base, id: 5 }])
      .mockResolvedValueOnce([]);
    expect(await panel.completeByText('Test task')).toBe(true);
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
      expect.arrayContaining([5]),
    );
  });

  it('delete() removes todo by id', async () => {
    const panel = new TodoPanel();
    await panel.delete(3);
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM todos WHERE id = ?', [3]);
  });

  it('render() shows Important section label for important todos', () => {
    const panel = new TodoPanel();
    panel.render([{ ...base, is_important: 1 }]);
    const labels = Array.from(document.querySelectorAll('.todo-section-label')).map(el => el.textContent);
    expect(labels).toContain('Important');
  });

  it('render() shows Due / Overdue section for past-deadline todos', () => {
    const panel = new TodoPanel();
    panel.render([{ ...base, deadline: '2020-01-01' }]);
    const labels = Array.from(document.querySelectorAll('.todo-section-label')).map(el => el.textContent);
    expect(labels).toContain('Due / Overdue');
  });

  it('render() displays correct open and done counts', () => {
    const panel = new TodoPanel();
    panel.render([base, { ...base, id: 2, is_completed: 1 }]);
    expect(document.getElementById('todoCount')!.textContent).toBe('1 open · 1 done');
  });

  it('render() shows checkmark for completed todos', () => {
    const panel = new TodoPanel();
    panel.render([{ ...base, is_completed: 1 }]);
    expect(document.querySelector('.completed-check')?.textContent).toBe('✓');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/TodoPanel.test.ts
git commit -m "test: add TodoPanel component tests"
```

---

## Task 12: Tests for SettingsModal

**Files:**
- Create: `src/__tests__/components/SettingsModal.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/__tests__/components/SettingsModal.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn().mockResolvedValue(undefined),
}));

import { getSetting, setSetting, execute } from '../../db.js';
import { SettingsModal } from '../../components/SettingsModal.js';

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);
const mockExecute = vi.mocked(execute);

function setupDom() {
  document.body.innerHTML = `
    <div id="settingsModal">
      <button id="settingsCloseBtn"></button>
      <select id="llmProviderSelect">
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
      </select>
      <input id="apiKeyInput" />
      <input id="llmModelInput" />
      <input id="llmBaseUrlInput" />
      <div id="baseUrlGroup"></div>
      <button id="saveSettingsBtn"></button>
    </div>
  `;
}

beforeEach(() => {
  setupDom();
  vi.clearAllMocks();
  mockGetSetting.mockResolvedValue(null);
  mockSetSetting.mockResolvedValue(undefined);
  mockExecute.mockResolvedValue(undefined);
});

describe('SettingsModal', () => {
  it('open() populates all four fields from db', async () => {
    mockGetSetting
      .mockResolvedValueOnce('anthropic')
      .mockResolvedValueOnce('sk-test')
      .mockResolvedValueOnce('claude-haiku-4-5-20251001')
      .mockResolvedValueOnce('');
    const modal = new SettingsModal();
    await modal.open();
    expect((document.getElementById('llmProviderSelect') as HTMLSelectElement).value).toBe('anthropic');
    expect((document.getElementById('apiKeyInput') as HTMLInputElement).value).toBe('sk-test');
    expect((document.getElementById('llmModelInput') as HTMLInputElement).value).toBe('claude-haiku-4-5-20251001');
  });

  it('baseUrl group is hidden when provider is anthropic', () => {
    const modal = new SettingsModal();
    const select = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    select.value = 'anthropic';
    select.dispatchEvent(new Event('change'));
    expect((document.getElementById('baseUrlGroup') as HTMLElement).style.display).toBe('none');
  });

  it('baseUrl group is visible when provider is openai', () => {
    const modal = new SettingsModal();
    const select = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    select.value = 'openai';
    select.dispatchEvent(new Event('change'));
    expect((document.getElementById('baseUrlGroup') as HTMLElement).style.display).toBe('block');
  });

  it('save() with empty API key deletes all four settings', async () => {
    const modal = new SettingsModal();
    (document.getElementById('apiKeyInput') as HTMLInputElement).value = '';
    document.getElementById('saveSettingsBtn')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?', ['llm_provider']);
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?', ['llm_api_key']);
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?', ['llm_model']);
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?', ['llm_base_url']);
  });

  it('save() with valid inputs writes all settings', async () => {
    const modal = new SettingsModal();
    (document.getElementById('apiKeyInput') as HTMLInputElement).value = 'sk-test';
    (document.getElementById('llmModelInput') as HTMLInputElement).value = 'claude-haiku-4-5-20251001';
    (document.getElementById('llmProviderSelect') as HTMLSelectElement).value = 'anthropic';
    document.getElementById('saveSettingsBtn')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockSetSetting).toHaveBeenCalledWith('llm_provider', 'anthropic');
    expect(mockSetSetting).toHaveBeenCalledWith('llm_api_key', 'sk-test');
    expect(mockSetSetting).toHaveBeenCalledWith('llm_model', 'claude-haiku-4-5-20251001');
  });

  it('save() with missing model calls alert and does not save', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const modal = new SettingsModal();
    (document.getElementById('apiKeyInput') as HTMLInputElement).value = 'sk-test';
    (document.getElementById('llmModelInput') as HTMLInputElement).value = '';
    document.getElementById('saveSettingsBtn')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(alertSpy).toHaveBeenCalledWith('Please enter a model name.');
    expect(mockSetSetting).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test src/__tests__/components/SettingsModal.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/SettingsModal.test.ts
git commit -m "test: add SettingsModal component tests"
```

---

## Task 13: Tests for ChatArea

**Files:**
- Create: `src/__tests__/components/ChatArea.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/__tests__/components/ChatArea.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({
  execute: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ai.js', () => ({
  formatLogEntry: vi.fn(),
}));

vi.mock('../../llm/factory.js', () => ({
  getAdapter: vi.fn().mockResolvedValue(null),
}));

import { ChatArea } from '../../components/ChatArea.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="chatArea"></div>';
  vi.clearAllMocks();
});

describe('ChatArea', () => {
  it('append() renders time, type label, and content', () => {
    const chat = new ChatArea();
    chat.append({ time: '09:30', type: 'log', typeLabel: 'Log entry', content: '<ul><li>Did work</li></ul>' });
    const area = document.getElementById('chatArea')!;
    expect(area.innerHTML).toContain('09:30');
    expect(area.innerHTML).toContain('Log entry');
    expect(area.innerHTML).toContain('Did work');
  });

  it('append() with rawInput renders the original-input block', () => {
    const chat = new ChatArea();
    chat.append({
      time: '09:30', type: 'log', typeLabel: 'Log entry',
      content: '<ul><li>Formatted</li></ul>',
      rawInput: 'raw text here',
    });
    expect(document.getElementById('chatArea')!.innerHTML).toContain('raw text here');
  });

  it('append() with entryId marks content as editable', () => {
    const chat = new ChatArea();
    chat.append({
      time: '09:30', type: 'log', typeLabel: 'Log entry',
      content: '<ul><li>Text</li></ul>',
      entryId: 5,
    });
    const content = document.querySelector('.msg-content') as HTMLElement;
    expect(content.dataset.editable).toBe('true');
  });

  it('clicking editable content opens a textarea with rawInput value', () => {
    const chat = new ChatArea();
    chat.append({
      time: '09:30', type: 'log', typeLabel: 'Log entry',
      content: '<ul><li>Text</li></ul>',
      rawInput: 'raw input',
      entryId: 1,
    });
    const content = document.querySelector('.msg-content') as HTMLElement;
    content.click();
    const textarea = content.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('raw input');
  });

  it('Cancel button restores the original HTML', () => {
    const chat = new ChatArea();
    const original = '<ul><li>Text</li></ul>';
    chat.append({
      time: '09:30', type: 'log', typeLabel: 'Log entry',
      content: original,
      rawInput: 'raw input',
      entryId: 1,
    });
    const content = document.querySelector('.msg-content') as HTMLElement;
    content.click();
    (content.querySelector('.msg-edit-cancel') as HTMLButtonElement).click();
    expect(content.innerHTML).toBe(original);
  });

  it('loadEntries() renders multiple entries in document order', () => {
    const chat = new ChatArea();
    chat.loadEntries([
      { id: 1, date: '2026-06-01', raw_text: 'r1', formatted_text: '<ul><li>first</li></ul>', created_at: '2026-06-01T09:00:00Z' },
      { id: 2, date: '2026-06-01', raw_text: 'r2', formatted_text: '<ul><li>second</li></ul>', created_at: '2026-06-01T10:00:00Z' },
    ]);
    const msgs = document.querySelectorAll('.msg');
    expect(msgs.length).toBe(2);
    expect(msgs[0].innerHTML).toContain('first');
    expect(msgs[1].innerHTML).toContain('second');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test src/__tests__/components/ChatArea.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 3: Run the full suite to confirm all tests pass**

```bash
pnpm test
```

Expected: all tests pass (approximately 71 tests across 12 files).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/components/ChatArea.test.ts
git commit -m "test: add ChatArea component tests"
```
