# CapLog Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all seed/mock data in the CapLog UI with real SQLite persistence, wire AI formatting via Claude API, and add a settings panel for API key management.

**Architecture:** The frontend (`src/main.ts`) already has all UI classes with mock data — each class will be updated to read/write from SQLite via a new `src/db.ts` abstraction. AI formatting lives in `src/ai.ts` and is called during log entry submission. API key is stored in a `settings` table in SQLite (no extra Rust plugin needed).

**Tech Stack:** Tauri v2, TypeScript, `@tauri-apps/plugin-sql` (SQLite), Anthropic Claude Haiku API via `fetch()`, Tauri FS + Dialog plugins for export.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src-tauri/migrations/001_init.sql` | Create | DB schema |
| `src-tauri/src/lib.rs` | Modify | Register SQL plugin |
| `src-tauri/capabilities/default.json` | Modify | Add SQL permissions |
| `src/db.ts` | Create | DB abstraction (init, query, execute) |
| `src/ai.ts` | Create | Claude API call for log formatting |
| `src/export.ts` | Create | Markdown export logic |
| `src/main.ts` | Modify | Wire all classes to real DB + AI |
| `src/index.html` | Modify | Add settings panel markup |
| `src-tauri/Cargo.toml` | Modify | Add FS + dialog plugins for export |
| `package.json` | Modify | Add FS + dialog packages for export |

---

## Task 1: SQLite Plugin Registration + Schema

**Files:**
- Create: `src-tauri/migrations/001_init.sql`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1.1: Create the migration file**

Create `src-tauri/migrations/001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS log_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL,
  raw_text       TEXT NOT NULL,
  formatted_text TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  text         TEXT NOT NULL,
  is_important INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  deadline     TEXT,
  created_at   TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- [ ] **Step 1.2: Register the SQL plugin in Rust**

Replace `src-tauri/src/lib.rs` with:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:caplog.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "init",
                        sql: include_str!("../migrations/001_init.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 1.3: Add SQL permissions to capabilities**

Replace `src-tauri/capabilities/default.json` with:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-load"
  ]
}
```

- [ ] **Step 1.4: Verify it compiles**

```bash
pnpm tauri dev
```

Expected: app opens with no console errors. Check DevTools console (right-click → Inspect) — no red errors.

- [ ] **Step 1.5: Commit**

```bash
git init  # if not already a repo
git add src-tauri/migrations/001_init.sql src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: register tauri-plugin-sql with initial schema migration"
```

---

## Task 2: Database Abstraction Layer

**Files:**
- Create: `src/db.ts`

- [ ] **Step 2.1: Create `src/db.ts`**

```typescript
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function initDB(): Promise<void> {
  db = await Database.load('sqlite:caplog.db');
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!db) throw new Error('DB not initialized');
  return db.select<T>(sql, params);
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  if (!db) throw new Error('DB not initialized');
  await db.execute(sql, params);
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}
```

- [ ] **Step 2.2: Update `src/main.ts` to initialize DB on startup**

At the top of `src/main.ts`, add the import:

```typescript
import { initDB } from './db.js';
```

Change the bootstrap block at the bottom of `src/main.ts` from:

```typescript
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
```

to:

```typescript
window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  new App();
});
```

- [ ] **Step 2.3: Verify it compiles**

```bash
pnpm build
```

Expected: exits with code 0. If TypeScript errors, fix them before continuing.

- [ ] **Step 2.4: Commit**

```bash
git add src/db.ts src/main.ts
git commit -m "feat: add DB abstraction layer and initialize on startup"
```

---

## Task 3: Todo Persistence

**Files:**
- Modify: `src/main.ts` — `TodoPanel` class

Replace the seed-data `TodoPanel` with a version that reads/writes from SQLite.

- [ ] **Step 3.1: Add DB imports to `src/main.ts`**

Update the import line at the top to:

```typescript
import { initDB, query, execute } from './db.js';
```

- [ ] **Step 3.2: Update the `TodoItem` interface to match DB columns**

Replace the existing `TodoItem` interface with:

```typescript
interface TodoItem {
  id: number;
  text: string;
  is_important: number;
  is_completed: number;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
}
```

- [ ] **Step 3.3: Replace `TodoPanel` class with the DB-backed version**

Replace the entire `TodoPanel` class (lines 72–178) with:

```typescript
class TodoPanel {
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
    const rows = await query<TodoItem>(
      'SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?)',
      [`%${text}%`]
    );
    if (rows.length === 0) return false;
    await this.complete(rows[0].id);
    return true;
  }

  private todoStatus(todo: TodoItem): string {
    if (todo.is_completed) return 'completed';
    if (todo.is_important) return 'important';
    if (todo.deadline) {
      const today = new Date().toISOString().split('T')[0];
      if (todo.deadline <= today) return 'overdue';
    }
    return 'open';
  }

  private renderItem(todo: TodoItem): HTMLElement {
    const status = this.todoStatus(todo);
    const el = document.createElement('div');
    el.className = `todo-item${status !== 'open' ? ` ${status}` : ''}`;
    el.dataset.id = String(todo.id);

    const checkInner = status === 'completed' ? '<span class="completed-check">✓</span>' : '';

    const metaHtml = (() => {
      const parts: string[] = [];
      if (todo.deadline) {
        parts.push(`<span class="todo-deadline${status === 'overdue' ? ' overdue' : ''}">${todo.deadline}</span>`);
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
      <div>
        <div class="todo-text">${todo.text}</div>
        ${metaHtml}
      </div>
    `;

    if (status !== 'completed') {
      el.addEventListener('click', () => this.complete(todo.id));
    }
    return el;
  }

  private render(todos: TodoItem[]): void {
    this.listEl.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    const sections: { label: string; filter: (t: TodoItem) => boolean }[] = [
      { label: 'Important', filter: (t) => !t.is_completed && !!t.is_important },
      { label: 'Upcoming', filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
      { label: 'Open', filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
      { label: 'Completed today', filter: (t) => !!t.is_completed },
    ];

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

- [ ] **Step 3.4: Update `App` constructor to await `todoPanel.load()`**

The `App` constructor currently calls `new TodoPanel()`. Change it to be async and load todos:

```typescript
class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;

  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    new Sidebar();
    this.initHeader();
    new InputHandler((value) => this.handleInput(value));
    this.todoPanel.load();
  }
  // ... rest unchanged
}
```

- [ ] **Step 3.5: Update `App.handleInput` to use async todo methods**

Replace the todo-related branches in `handleInput`:

```typescript
private async handleInput(value: string): Promise<void> {
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  if (value.startsWith('/todo')) {
    const rest = value.replace('/todo', '').trim();
    const byIdx = rest.indexOf(' /by ');
    let text = rest;
    let deadline: string | null = null;
    if (byIdx !== -1) {
      text = rest.slice(0, byIdx).trim();
      deadline = rest.slice(byIdx + 5).trim();
    }
    await this.todoPanel.add(text, false, deadline);
    const label = deadline ? `Todo created — due ${deadline}` : 'Todo created';
    this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: text });

  } else if (value.startsWith('/done')) {
    const task = value.replace('/done', '').trim();
    const found = await this.todoPanel.completeByText(task);
    this.chatArea.append({
      time, type: 'system', typeLabel: 'System',
      content: found
        ? `Marked <span style="color:var(--text)">"${task}"</span> as complete.`
        : `No active todo matching "${task}" found.`,
    });

  } else if (value.startsWith('/important')) {
    const text = value.replace('/important', '').trim();
    await this.todoPanel.add(text, true, null);
    this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: text });

  } else {
    this.chatArea.append({
      time, type: 'log', typeLabel: 'Log entry',
      content: `<ul><li>${value}</li></ul>`,
      rawInput: value,
    });
  }
}
```

- [ ] **Step 3.6: Run the app and test**

```bash
pnpm tauri dev
```

Manual tests:
1. Type `/todo Buy milk` — todo appears in right panel
2. Click the todo — it moves to "Completed today"
3. Type `/important Fix auth bug` — todo appears under "Important"
4. Type `/todo Pay bills /by 2026-06-01` — todo appears with deadline
5. Type `/done Buy milk` — system message appears; "Buy milk" moves to completed
6. Quit and reopen — todos persist

- [ ] **Step 3.7: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire TodoPanel to SQLite — todos persist across restarts"
```

---

## Task 4: Log Entry Persistence

**Files:**
- Modify: `src/main.ts` — `ChatArea` class + `App.handleInput`

- [ ] **Step 4.1: Add a DB-backed `LogEntry` type**

Add this interface near the top of `src/main.ts` (after `Message`):

```typescript
interface LogEntry {
  id: number;
  date: string;
  raw_text: string;
  formatted_text: string;
  created_at: string;
}
```

- [ ] **Step 4.2: Remove seed messages from `ChatArea`**

In `ChatArea`, remove the `loadSeedMessages()` call from the constructor and delete the `loadSeedMessages()` method entirely. The constructor becomes:

```typescript
constructor() {
  this.el = document.getElementById('chatArea')!;
  this.appendDivider('Today');
}
```

- [ ] **Step 4.3: Add a `loadEntries` method to `ChatArea`**

Add this method to `ChatArea`:

```typescript
loadEntries(entries: LogEntry[]): void {
  for (const entry of entries) {
    const time = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    this.append({
      time,
      type: 'log',
      typeLabel: 'Log entry',
      content: entry.formatted_text,
      rawInput: entry.raw_text !== entry.formatted_text ? entry.raw_text : undefined,
    });
  }
}
```

- [ ] **Step 4.4: Update `App` to load today's log entries on startup**

Add a `loadTodayEntries` method to `App` and call it from constructor:

```typescript
constructor() {
  this.chatArea = new ChatArea();
  this.todoPanel = new TodoPanel();
  this.modal = new LogModal();
  new Sidebar();
  this.initHeader();
  new InputHandler((value) => this.handleInput(value));
  this.todoPanel.load();
  this.loadTodayEntries();
}

private async loadTodayEntries(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const entries = await query<LogEntry>(
    'SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC',
    [today]
  );
  this.chatArea.loadEntries(entries);
}
```

- [ ] **Step 4.5: Save log entries to DB in `handleInput`**

In the `else` branch of `handleInput` (plain text = log entry), replace with:

```typescript
} else {
  const today = new Date().toISOString().split('T')[0];
  await execute(
    'INSERT INTO log_entries (date, raw_text, formatted_text, created_at) VALUES (?, ?, ?, ?)',
    [today, value, `<ul><li>${value}</li></ul>`, new Date().toISOString()]
  );
  this.chatArea.append({
    time, type: 'log', typeLabel: 'Log entry',
    content: `<ul><li>${value}</li></ul>`,
    rawInput: value,
  });
}
```

- [ ] **Step 4.6: Run the app and test**

```bash
pnpm tauri dev
```

Manual tests:
1. Type a plain message like `fixed the login bug` — appears in chat
2. Quit and reopen — today's log entry reappears
3. Log entries accumulate within the same day

- [ ] **Step 4.7: Commit**

```bash
git add src/main.ts
git commit -m "feat: persist log entries to SQLite and reload on startup"
```

---

## Task 5: Sidebar With Real Data

**Files:**
- Modify: `src/main.ts` — `Sidebar` class

- [ ] **Step 5.1: Add a `DayStats` DB type**

Add this interface near the top of `src/main.ts`:

```typescript
interface DayStats {
  date: string;
  log_count: number;
  todo_done_count: number;
  preview: string;
}
```

- [ ] **Step 5.2: Replace `Sidebar` with a DB-backed version**

Replace the entire `Sidebar` class with:

```typescript
class Sidebar {
  private monthLabel: HTMLElement;
  private dayList: HTMLElement;

  constructor() {
    this.monthLabel = document.getElementById('sidebarMonthLabel')!;
    this.dayList = document.getElementById('dayList')!;
    const now = new Date();
    this.monthLabel.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.load();
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
        <div class="day-entry-preview">${s.preview ?? ''}</div>
        <div class="day-entry-meta">${metaTags.join('')}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      document.querySelectorAll('.day-entry').forEach((e) => e.classList.remove('active'));
      el.classList.add('active');
    });
    return el;
  }
}
```

- [ ] **Step 5.3: Run the app and test**

```bash
pnpm tauri dev
```

Manual tests:
1. Add a few log entries
2. Sidebar shows today with correct entry count and preview text
3. Sidebar shows no seed entries (only real data)

- [ ] **Step 5.4: Commit**

```bash
git add src/main.ts
git commit -m "feat: sidebar loads real history from SQLite"
```

---

## Task 6: Log Modal With Real Data

**Files:**
- Modify: `src/main.ts` — `App.openLogModal`

- [ ] **Step 6.1: Replace `App.openLogModal` with a DB query**

Replace the `openLogModal` method with:

```typescript
private async openLogModal(): Promise<void> {
  const entries = await query<LogEntry>(
    'SELECT * FROM log_entries ORDER BY date DESC, created_at ASC'
  );

  const grouped = new Map<string, { text: string; time: string }[]>();
  for (const e of entries) {
    const time = new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    grouped.get(e.date)!.push({ text: e.formatted_text.replace(/<[^>]+>/g, '').trim(), time });
  }

  const modalData = Array.from(grouped.entries()).map(([date, items]) => {
    const d = new Date(date + 'T00:00:00');
    const label = d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return { date: label, items };
  });

  this.modal.open(modalData);
}
```

- [ ] **Step 6.2: Run and test**

```bash
pnpm tauri dev
```

Manual tests:
1. Add several log entries
2. Click "View Log" button in the header
3. Modal shows real entries grouped by date

- [ ] **Step 6.3: Commit**

```bash
git add src/main.ts
git commit -m "feat: log modal shows real entries from SQLite"
```

---

## Task 7: AI Formatting

**Files:**
- Create: `src/ai.ts`
- Modify: `src/main.ts` — `App.handleInput` + `InputHandler`

- [ ] **Step 7.1: Create `src/ai.ts`**

```typescript
export async function formatLogEntry(rawText: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Clean up and format this into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points as HTML <ul><li>...</li></ul> with no preamble or explanation:\n\n${rawText}`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  const data = await response.json();
  return (data.content[0].text as string).trim();
}
```

- [ ] **Step 7.2: Add `getSetting` import to `src/main.ts`**

Update the import at the top of `src/main.ts`:

```typescript
import { initDB, query, execute, getSetting } from './db.js';
import { formatLogEntry } from './ai.js';
```

- [ ] **Step 7.3: Add a `setLoading` method to `InputHandler`**

Add this method to `InputHandler`:

```typescript
setLoading(loading: boolean): void {
  this.input.disabled = loading;
  const btn = document.getElementById('sendBtn')!;
  btn.textContent = loading ? '...' : 'Send';
  (btn as HTMLButtonElement).disabled = loading;
}
```

Make `InputHandler` expose itself so `App` can call `setLoading`. Change the `App` constructor to store the `InputHandler`:

```typescript
class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;
  private inputHandler!: InputHandler;

  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    new Sidebar();
    this.initHeader();
    this.inputHandler = new InputHandler((value) => this.handleInput(value));
    this.todoPanel.load();
    this.loadTodayEntries();
  }
  // ... rest unchanged
}
```

- [ ] **Step 7.4: Update `handleInput` log branch to use AI**

Replace the `else` branch (plain text log entry) with:

```typescript
} else {
  const today = new Date().toISOString().split('T')[0];
  const apiKey = await getSetting('anthropic_api_key');

  let formatted = `<ul><li>${value}</li></ul>`;

  if (apiKey) {
    this.inputHandler.setLoading(true);
    try {
      formatted = await formatLogEntry(value, apiKey);
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
    [today, value, formatted, new Date().toISOString()]
  );
  this.chatArea.append({
    time, type: 'log', typeLabel: 'Log entry',
    content: formatted,
    rawInput: value,
  });
}
```

- [ ] **Step 7.5: Test without an API key first**

```bash
pnpm tauri dev
```

1. No API key is set — log entry saves with raw text formatted as `<ul><li>...</li></ul>`. No error toast.
2. Input is NOT locked — setLoading is not called when there's no key.

- [ ] **Step 7.6: Commit**

```bash
git add src/ai.ts src/main.ts
git commit -m "feat: AI formatting with Claude Haiku — falls back to raw text without API key"
```

---

## Task 8: Settings Panel (API Key)

**Files:**
- Modify: `src/index.html` — add settings modal markup
- Modify: `src/styles.css` — add settings modal styles
- Modify: `src/main.ts` — `App.initHeader` + settings logic

- [ ] **Step 8.1: Add settings modal to `src/index.html`**

Find the closing `</body>` tag in `src/index.html` and insert this before it:

```html
<div id="settingsModal" class="modal-overlay">
  <div class="modal-dialog">
    <div class="modal-header">
      <span class="modal-title">Settings</span>
      <button class="modal-close-btn" id="settingsCloseBtn">✕</button>
    </div>
    <div class="modal-body settings-body">
      <label class="settings-label">Anthropic API Key</label>
      <input
        type="password"
        id="apiKeyInput"
        class="settings-input"
        placeholder="sk-ant-..."
      />
      <p class="settings-hint">Used for AI log formatting. Stored locally, never sent anywhere else.</p>
      <button id="saveSettingsBtn" class="settings-save-btn">Save</button>
    </div>
  </div>
</div>
```

Also add a gear icon button to the header. Find the header buttons area and add:

```html
<button id="settingsBtn" class="icon-btn" title="Settings">⚙</button>
```

- [ ] **Step 8.2: Add settings styles to `src/styles.css`**

Append to `src/styles.css`:

```css
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
.settings-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.settings-input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.settings-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}
.settings-save-btn {
  align-self: flex-start;
  background: var(--accent, #4f8ef7);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
.settings-save-btn:hover {
  opacity: 0.85;
}
```

- [ ] **Step 8.3: Add `SettingsModal` class to `src/main.ts`**

Add this class before the `App` class:

```typescript
class SettingsModal {
  private overlay: HTMLElement;
  private apiKeyInput: HTMLInputElement;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;

    document.getElementById('settingsCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.getElementById('saveSettingsBtn')!.addEventListener('click', () => this.save());
  }

  async open(): Promise<void> {
    const key = await getSetting('anthropic_api_key');
    this.apiKeyInput.value = key ?? '';
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  private async save(): Promise<void> {
    const key = this.apiKeyInput.value.trim();
    if (key) await setSetting('anthropic_api_key', key);
    this.close();
  }
}
```

- [ ] **Step 8.4: Update imports in `src/main.ts`**

```typescript
import { initDB, query, execute, getSetting, setSetting } from './db.js';
```

- [ ] **Step 8.5: Wire settings into `App`**

Add `private settings: SettingsModal;` to `App`, initialize it in constructor, and add the button handler in `initHeader`:

```typescript
// In App constructor, add:
this.settings = new SettingsModal();

// In App.initHeader, add:
document.getElementById('settingsBtn')?.addEventListener('click', () => this.settings.open());
```

- [ ] **Step 8.6: Run and test**

```bash
pnpm tauri dev
```

1. Click ⚙ button — settings modal opens
2. Paste an Anthropic API key and click Save
3. Close the settings modal
4. Type a log entry — it shows AI-formatted bullet points within 1–2 seconds
5. Reopen settings — key is still there
6. Type another log entry — AI formatting works again

- [ ] **Step 8.7: Commit**

```bash
git add src/index.html src/styles.css src/main.ts
git commit -m "feat: settings panel for API key storage; AI formatting now live"
```

---

## Task 9: Markdown Export

**Files:**
- Modify: `src-tauri/Cargo.toml` — add fs + dialog plugins
- Modify: `package.json` — add fs + dialog packages
- Modify: `src-tauri/capabilities/default.json` — add fs + dialog permissions
- Modify: `src-tauri/src/lib.rs` — register plugins
- Create: `src/export.ts`
- Modify: `src/main.ts` — wire export button

- [ ] **Step 9.1: Install frontend packages**

```bash
pnpm add @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
```

- [ ] **Step 9.2: Add Rust crate dependencies**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

- [ ] **Step 9.3: Register plugins in `src-tauri/src/lib.rs`**

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:caplog.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "init",
                        sql: include_str!("../migrations/001_init.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 9.4: Add capabilities for fs + dialog**

In `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-load",
    "fs:allow-write-text-file",
    "dialog:allow-save"
  ]
}
```

- [ ] **Step 9.5: Create `src/export.ts`**

```typescript
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { query } from './db.js';

interface LogEntry {
  date: string;
  formatted_text: string;
  created_at: string;
}

export async function exportMarkdown(): Promise<void> {
  const entries = await query<LogEntry>(
    'SELECT date, formatted_text, created_at FROM log_entries ORDER BY date DESC, created_at ASC'
  );

  const grouped = new Map<string, string[]>();
  for (const e of entries) {
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    const text = e.formatted_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    grouped.get(e.date)!.push(`- ${text}`);
  }

  let md = '# CapLog Export\n\n';
  for (const [date, lines] of grouped.entries()) {
    const d = new Date(date + 'T00:00:00');
    md += `## ${d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n\n`;
    md += lines.join('\n') + '\n\n';
  }

  const today = new Date().toISOString().split('T')[0];
  const path = await save({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    defaultPath: `caplog-export-${today}.md`,
  });

  if (path) await writeTextFile(path, md);
}
```

- [ ] **Step 9.6: Wire export button in `App.initHeader`**

In `src/main.ts`, add the export import:

```typescript
import { exportMarkdown } from './export.js';
```

In `App.initHeader`, add:

```typescript
document.getElementById('exportBtn')?.addEventListener('click', () => exportMarkdown());
```

Add an export button to `src/index.html` header (next to "View Log"):

```html
<button id="exportBtn" class="header-btn">Export</button>
```

- [ ] **Step 9.7: Run and test**

```bash
pnpm tauri dev
```

1. Add a few log entries
2. Click "Export" — native save dialog appears
3. Save the file
4. Open the file — it contains dated markdown with bullet points

- [ ] **Step 9.8: Commit**

```bash
git add src/export.ts src/main.ts src/index.html src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json pnpm-lock.yaml
git commit -m "feat: markdown export via native save dialog"
```

---

## Task 10: Polish

**Files:**
- Modify: `src-tauri/tauri.conf.json` — window size
- Modify: `src/styles.css` — loading spinner
- Modify: `src/main.ts` — empty states + Escape shortcut for settings

- [ ] **Step 10.1: Set proper window dimensions in `tauri.conf.json`**

In `src-tauri/tauri.conf.json`, update the `windows` array:

```json
"windows": [
  {
    "title": "caplog",
    "width": 1200,
    "height": 800,
    "minWidth": 800,
    "minHeight": 600
  }
]
```

- [ ] **Step 10.2: Add loading spinner CSS to `src/styles.css`**

Append to `src/styles.css`:

```css
.send-btn-loading {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}
```

- [ ] **Step 10.3: Add empty state to `ChatArea`**

In `ChatArea.appendDivider`, after appending the divider, add an empty state element:

```typescript
appendDivider(label: string): void {
  // ... existing code ...
  this.el.appendChild(el);

  const empty = document.createElement('div');
  empty.className = 'chat-empty-state';
  empty.id = 'chatEmptyState';
  empty.textContent = 'No entries yet — type anything to log your day.';
  this.el.appendChild(empty);
}

append(msg: Message): void {
  document.getElementById('chatEmptyState')?.remove();
  // ... existing code unchanged ...
}
```

- [ ] **Step 10.4: Add Escape shortcut for settings modal**

In `SettingsModal` constructor, add:

```typescript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') this.close();
});
```

- [ ] **Step 10.5: Add `Cmd+E` shortcut for export**

In `App.initHeader`, add:

```typescript
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault();
    exportMarkdown();
  }
});
```

- [ ] **Step 10.6: Run full manual test**

```bash
pnpm tauri dev
```

Full regression:
1. Window opens at correct size (1200×800)
2. Empty state message shows on fresh start
3. Add a log entry — empty state disappears
4. Add todos with `/todo`, `/important`, `/todo x /by 2026-06-01`
5. Complete a todo by clicking or `/done`
6. Open "View Log" — real entries show
7. Click "Export" — save dialog opens, file is valid markdown
8. Press `Cmd+E` — save dialog opens
9. Open settings (⚙), save an API key
10. Type a log entry — AI-formatted bullet points appear (spinner while waiting)
11. Quit and reopen — everything persists

- [ ] **Step 10.7: Commit**

```bash
git add src-tauri/tauri.conf.json src/styles.css src/main.ts
git commit -m "feat: polish — window size, empty state, keyboard shortcuts"
```

---

---

## Task 11: Delete Todo

**Files:**
- Modify: `src/main.ts` — `TodoPanel.renderItem` + `TodoPanel` (new `delete` method)
- Modify: `src/styles.css` — delete button styles

- [ ] **Step 11.1: Add delete button styles to `src/styles.css`**

Append to `src/styles.css`:

```css
.todo-delete-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  line-height: 1;
  margin-left: auto;
  flex-shrink: 0;
  transition: color 0.1s;
}

.todo-item:hover .todo-delete-btn {
  display: block;
}

.todo-delete-btn:hover {
  color: var(--red);
}
```

- [ ] **Step 11.2: Add `delete` method to `TodoPanel` in `src/main.ts`**

Add this method to the `TodoPanel` class, after the `completeByText` method:

```typescript
async delete(id: number): Promise<void> {
  await execute('DELETE FROM todos WHERE id = ?', [id]);
  await this.load();
}
```

- [ ] **Step 11.3: Update `TodoPanel.renderItem` to include the delete button**

Replace the `renderItem` method in `TodoPanel`:

```typescript
private renderItem(todo: TodoItem): HTMLElement {
  const status = this.todoStatus(todo);
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
      this.complete(todo.id);
    });
  }

  el.querySelector('.todo-delete-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    this.delete(todo.id);
  });

  return el;
}
```

- [ ] **Step 11.4: Run and test**

```bash
pnpm tauri dev
```

Manual tests:
1. Add a todo with `/todo Test delete`
2. Hover over it — `✕` button appears on the right
3. Click `✕` — todo disappears immediately
4. Quit and reopen — deleted todo does not come back
5. Click the todo row itself (not `✕`) — it still completes normally

- [ ] **Step 11.5: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat: delete todo via hover ✕ button"
```

---

## Task 12: Edit Log Entry Inline

**Files:**
- Modify: `src/main.ts` — `ChatArea` + `ChatArea.append` + new `editEntry` logic
- Modify: `src/styles.css` — inline edit styles

The edit flow: clicking a log entry's content swaps it for a textarea pre-filled with the raw input. Save re-runs AI formatting (if API key set) or saves the text as-is. Cancel reverts to original display.

- [ ] **Step 12.1: Add `LogEntry` id to the message interface**

The `Message` interface in `src/main.ts` needs to carry the DB row id so edits can be saved back. Update the interface:

```typescript
interface Message {
  time: string;
  type: MessageType;
  typeLabel: string;
  content: string;
  rawInput?: string;
  entryId?: number;   // only set for 'log' type messages loaded from DB
}
```

- [ ] **Step 12.2: Pass `entryId` when loading entries from DB**

In `ChatArea.loadEntries`, update the `this.append()` call:

```typescript
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
```

Also update `App.handleInput` to pass the new entry id after inserting. Change the `execute` call + `chatArea.append` in the log branch:

```typescript
} else {
  const today = new Date().toISOString().split('T')[0];
  const apiKey = await getSetting('anthropic_api_key');

  let formatted = `<ul><li>${escapeHtml(value)}</li></ul>`;

  if (apiKey) {
    this.inputHandler.setLoading(true);
    try {
      formatted = await formatLogEntry(value, apiKey);
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
    [today, value, formatted, new Date().toISOString()]
  );

  const rows = await query<{ id: number }>(
    'SELECT id FROM log_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1',
    [today]
  );

  this.chatArea.append({
    time, type: 'log', typeLabel: 'Log entry',
    content: formatted,
    rawInput: value,
    entryId: rows[0]?.id,
  });
}
```

- [ ] **Step 12.3: Add inline edit styles to `src/styles.css`**

Append to `src/styles.css`:

```css
.msg-edit-area {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 15px;
  padding: 8px 10px;
  resize: vertical;
  min-height: 80px;
  line-height: 1.6;
  outline: none;
  box-sizing: border-box;
}

.msg-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.msg-edit-save {
  background: var(--accent);
  border: none;
  color: var(--bg);
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 13px;
}

.msg-edit-cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 13px;
}

.msg-edit-cancel:hover {
  border-color: var(--border-hover);
  color: var(--text);
}

.msg-content[data-editable="true"] {
  cursor: pointer;
}

.msg-content[data-editable="true"]:hover {
  opacity: 0.75;
}
```

- [ ] **Step 12.4: Update `ChatArea.append` to wire inline editing**

Replace the `append` method in `ChatArea`:

```typescript
append(msg: Message): void {
  document.getElementById('chatEmptyState')?.remove();

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
  if (msgEl.querySelector('.msg-edit-area')) return; // already editing

  const originalHtml = contentEl.innerHTML;
  contentEl.innerHTML = '';

  const textarea = document.createElement('textarea');
  textarea.className = 'msg-edit-area';
  textarea.value = msg.rawInput ?? contentEl.textContent ?? '';
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

    const apiKey = await getSetting('anthropic_api_key');
    let formatted = `<ul><li>${escapeHtml(newText)}</li></ul>`;

    if (apiKey) {
      try {
        formatted = await formatLogEntry(newText, apiKey);
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
```

- [ ] **Step 12.5: Ensure `getSetting` and `formatLogEntry` are accessible in `ChatArea`**

`ChatArea` is a class in `src/main.ts` and both `getSetting` (from `./db.js`) and `formatLogEntry` (from `./ai.js`) are already imported at the top of that file, so they are in scope. No extra imports needed.

- [ ] **Step 12.6: Run and test**

```bash
pnpm tauri dev
```

Manual tests:
1. Type a plain log entry — it appears in the chat
2. Click the log entry text — a textarea appears, pre-filled with the raw input
3. Edit the text and click Save — the formatted text updates in place
4. Click Cancel — original text is restored
5. Quit and reopen — edited entry is still there
6. With an API key set: edit and save — AI re-formats the updated text

- [ ] **Step 12.7: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat: inline edit for log entries — click to edit, re-format on save"
```

---

## Task 13: Security & Reliability Hardening

**From code review 2026-05-31. Address before Task 11/12 ship.**

### 13.1 — Fix XSS: escape rawInput and plain-text content in ChatArea

**Root cause:** `ChatArea.append()` inserts `msg.rawInput` and some `msg.content` values via `innerHTML` without escaping.

**Files:** `src/main.ts`

- [ ] **Step 13.1.1:** In `ChatArea.append()` (line ~251), change the rawHtml block to escape rawInput:
```typescript
const rawHtml = msg.rawInput
  ? `<div class="msg-raw"><div class="msg-raw-label">Original input</div>${escapeHtml(msg.rawInput)}</div>`
  : '';
```

- [ ] **Step 13.1.2:** In `App.handleInput`, the `/todo` branch passes `text` (raw user input) as `content`. Wrap it:
```typescript
this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: escapeHtml(text) });
```

- [ ] **Step 13.1.3:** Same fix for `/important` branch — `content: escapeHtml(text)`.

- [ ] **Step 13.1.4:** In the `/done` branch, escape `task` before embedding in the HTML string:
```typescript
content: found
  ? `Marked <span style="color:var(--text)">"${escapeHtml(task)}"</span> as complete.`
  : `No active todo matching "${escapeHtml(task)}" found.`,
```

---

### 13.2 — Fix broken HTML tag-stripping regex

**Root cause:** `/<[^>]+>/g` fails on tags whose attributes contain `>` (e.g. `data-x="a>b"`), leaving partial HTML injected into `innerHTML`.

**Files:** `src/main.ts` (line ~473 in `openLogModal`), `src/export.ts` (line 19)

- [ ] **Step 13.2.1:** Replace the regex-based strip with a proper DOM approach in `openLogModal`:
```typescript
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}
```
Then use `stripHtml(e.formatted_text)` instead of `.replace(/<[^>]+>/g, '').trim()`.

- [ ] **Step 13.2.2:** Apply the same `stripHtml` in `export.ts` line 19 instead of the regex.

---

### 13.3 — Fix LIKE wildcard injection in `completeByText`

**Root cause:** User-supplied text is interpolated into a LIKE pattern; `%` and `_` match unintended todos.

**File:** `src/main.ts` line ~130

- [ ] **Step 13.3.1:** Escape LIKE metacharacters before interpolation:
```typescript
const escaped = text.replace(/[%_\\]/g, '\\$&');
const rows = await query<TodoItem>(
  "SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?) ESCAPE '\\'",
  [`%${escaped}%`]
);
```

---

### 13.4 — Validate API key before saving

**Root cause:** `SettingsModal.save()` persists `''` as a key; it's truthy-checked later but causes a confusing 401.

**File:** `src/main.ts` line ~409

- [ ] **Step 13.4.1:** In `SettingsModal.save()`, only write non-empty keys:
```typescript
private async save(): Promise<void> {
  const key = this.apiKeyInput.value.trim();
  if (key) {
    await setSetting('anthropic_api_key', key);
  } else {
    await execute('DELETE FROM settings WHERE key = ?', ['anthropic_api_key']);
  }
  this.close();
}
```

---

### 13.5 — Store Sidebar reference and refresh after mutations

**Root cause:** `new Sidebar()` instance is discarded; sidebar is never updated after log/todo writes.

**File:** `src/main.ts`

- [ ] **Step 13.5.1:** Store sidebar on `App` and expose a `refresh()` method:
```typescript
private sidebar: Sidebar;
// in constructor:
this.sidebar = new Sidebar();
```
Add `refresh(): Promise<void>` to `Sidebar` that calls `this.load()`.

- [ ] **Step 13.5.2:** Call `void this.sidebar.refresh()` after each write in `handleInput` (after log insert, after todo add).

---

### 13.6 — Add error handling to startup async loads

**Root cause:** `todoPanel.load()` and `loadTodayEntries()` are fire-and-forget in the constructor; DB errors are invisible.

**File:** `src/main.ts` line ~432

- [ ] **Step 13.6.1:** Wrap both in an `init()` method with error feedback:
```typescript
private async init(): Promise<void> {
  try {
    await Promise.all([this.todoPanel.load(), this.loadTodayEntries()]);
  } catch (err) {
    console.error('Startup load failed:', err);
    this.chatArea.append({ time: '--:--', type: 'system', typeLabel: 'System',
      content: 'Failed to load data. Please restart the app.' });
  }
}
```
Call `void this.init()` from the constructor instead.

---

## Milestone Summary

| Task | What it delivers | Status |
|---|---|---|
| 1 — SQLite setup | Schema migration + Rust plugin | - [x] |
| 2 — DB layer | `src/db.ts` abstraction | - [x] |
| 3 — Todo persistence | Todos survive restart | - [x] |
| 4 — Log persistence | Log entries survive restart | - [x] |
| 5 — Sidebar real data | Sidebar shows actual history | - [x] |
| 6 — Log modal real data | Modal shows actual entries | - [x] |
| 7 — AI formatting | Claude Haiku cleans up log text | - [x] |
| 8 — Settings panel | API key stored + retrieved | - [x] |
| 9 — Export | Markdown file save dialog | - [x] |
| 10 — Polish | Window size, empty states, shortcuts | - [x] |
| 11 — Delete todo | Hover ✕ removes todo permanently | - [ ] |
| 12 — Edit log entry | Click to edit, re-format, and save | - [ ] |
| 13 — Security hardening | XSS fixes, LIKE escaping, sidebar refresh, error handling | - [ ] |
