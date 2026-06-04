# X-Days Cutoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Pending

**Goal:** Wire the existing `chat_days` setting into `Sidebar` (LIMIT) and `TodoPanel` (completed-todo cutoff), with live refresh on settings save — no restart required.

**Architecture:** `App` owns a `chatDays: number` field and a new `applyChatDays()` method that reads the DB setting and pushes the value into `Sidebar.refresh(days)` and `TodoPanel.load(days)`. Each component stores the last-used value internally so subsequent no-arg calls (triggered by internal refreshes) reuse it. `SettingsModal` gains a `setOnSave(cb)` hook that `App` uses to trigger `applyChatDays()` immediately after save.

**Tech Stack:** TypeScript (vanilla), SQLite via `src/db.ts` `query()`, Vitest + happy-dom.

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/Sidebar.ts` | Add `private days`, change `refresh(days?)`, parameterize LIMIT, remove constructor `load()` call |
| Create | `src/__tests__/components/Sidebar.test.ts` | New test file for Sidebar LIMIT behavior |
| Modify | `src/components/TodoPanel.ts` | Add `private cutoffDays`, change `load(days?)`, add cutoff SQL filter |
| Modify | `src/__tests__/components/TodoPanel.test.ts` | Add cutoff SQL assertion test |
| Modify | `src/components/SettingsModal.ts` | Add `private onSaveCallback`, add `setOnSave(cb)`, call cb on save |
| Modify | `src/__tests__/components/SettingsModal.test.ts` | Add wiring test: save → sidebar LIMIT changes |
| Modify | `src/app.ts` | Add `chatDays` field, `applyChatDays()`, update `init()`, wire `setOnSave` |

---

## Task 1: Sidebar cutoff (TDD)

**Files:**
- Create: `src/__tests__/components/Sidebar.test.ts`
- Modify: `src/components/Sidebar.ts`

- [ ] **Step 1: Create failing tests**

Create `src/__tests__/components/Sidebar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../../components/Sidebar.js';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db.js', () => ({
  query: queryMock,
  execute: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  initDB: vi.fn().mockResolvedValue(undefined),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sidebarMonthLabel"></div>
      <div id="dayList"></div>
    `;
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
  });

  it('refresh(5) queries log_entries with LIMIT 5', async () => {
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(5);

    const call = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('log_entries') && String(sql).includes('LIMIT')
    );
    expect(call).toBeDefined();
    expect(call![1]).toEqual([5]);
  });

  it('refresh() with no arg reuses the last stored days value', async () => {
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(7);
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);

    await sidebar.refresh();

    const call = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('log_entries') && String(sql).includes('LIMIT')
    );
    expect(call).toBeDefined();
    expect(call![1]).toEqual([7]);
  });

  it('refresh(2) after refresh(7) switches LIMIT to 2', async () => {
    const sidebar = new Sidebar(vi.fn());
    await sidebar.refresh(7);
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);

    await sidebar.refresh(2);

    const call = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('log_entries') && String(sql).includes('LIMIT')
    );
    expect(call).toBeDefined();
    expect(call![1]).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/__tests__/components/Sidebar.test.ts`
Expected: failures — `Sidebar.refresh` doesn't accept args and query uses `LIMIT 30`.

- [ ] **Step 3: Implement Sidebar changes**

Replace the entire content of `src/components/Sidebar.ts` with:

```typescript
import { query } from '../db.js';
import { escapeHtml } from '../utils.js';
import type { DayStats } from '../types.js';

export class Sidebar {
  private monthLabel: HTMLElement;
  private dayList: HTMLElement;
  private days: number = 3;

  constructor(private onDaySelect: (date: string) => void) {
    this.monthLabel = document.getElementById('sidebarMonthLabel')!;
    this.dayList = document.getElementById('dayList')!;
    const now = new Date();
    this.monthLabel.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  refresh(days?: number): Promise<void> {
    if (days !== undefined) this.days = days;
    return this.load();
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
      LIMIT ?
    `, [this.days]);

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

Key changes from original:
- Removed `import { getSetting }` (not needed)
- Added `private days: number = 3`
- Removed `this.load()` from constructor (App.applyChatDays() drives the first load)
- `refresh()` → `refresh(days?: number): Promise<void>` — stores days, returns the load Promise
- SQL `LIMIT 30` → `LIMIT ?` with `[this.days]` as parameter

- [ ] **Step 4: Run tests — confirm they pass**

Run: `pnpm test src/__tests__/components/Sidebar.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.ts src/__tests__/components/Sidebar.test.ts
git commit -m "feat: sidebar respects chat_days limit via refresh(days)"
```

---

## Task 1b: Remove hardcoded Archive section from todoLogic (TDD)

**Context:** The entry-todo-enhancements feature (already implemented) added a hardcoded 7-day "Archive" section to `getTodoSections()` in `src/todoLogic.ts`. The x-days cutoff plan filters old completed todos at the SQL level — they are never fetched. If `getTodoSections()` still has the Archive section, todos between 7 and `chat_days` days old will appear in the "Archive" section instead of being hidden, which contradicts the spec. The fix: remove the Archive section entirely and simplify the "Completed" filter to `t.is_completed` (the SQL already handles the date cutoff).

**Files:**
- Modify: `src/todoLogic.ts`
- Modify: `src/__tests__/todoLogic.test.ts`

- [ ] **Step 1: Replace the archive-split tests with a replacement test**

Open `src/__tests__/todoLogic.test.ts`. Remove the entire `describe('getTodoSections — archive split', ...)` block (lines ~54–87). Replace it with:

```typescript
describe('getTodoSections — completed section', () => {
  it('returns no section with label "Archive"', () => {
    const sections = getTodoSections();
    expect(sections.find(s => s.label === 'Archive')).toBeUndefined();
  });

  it('completed todo (completed today) appears in Completed section', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const recent = makeTodo({ is_completed: 1, completed_at: new Date().toISOString() });
    expect(completed.filter(recent)).toBe(true);
  });

  it('completed todo with old completed_at still appears in Completed section', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const oldTodo = makeTodo({ is_completed: 1, completed_at: old.toISOString() });
    expect(completed.filter(oldTodo)).toBe(true);
  });

  it('completed todo with null completed_at appears in Completed section', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const noDate = makeTodo({ is_completed: 1, completed_at: null });
    expect(completed.filter(noDate)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — confirm the new ones fail**

Run: `pnpm test src/__tests__/todoLogic.test.ts`
Expected: the 4 new tests fail — `getTodoSections()` still returns an Archive section and the Completed filter still rejects old todos.

- [ ] **Step 3: Update `src/todoLogic.ts`**

Replace the entire file with:

```typescript
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

  return [
    { label: 'Important',    filter: (t) => !t.is_completed && !!t.is_important },
    { label: 'Due / Overdue', filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
    { label: 'Open',          filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
    { label: 'Completed',     filter: (t) => !!t.is_completed },
  ];
}
```

Key changes from original:
- Removed `archiveCutoff` and `cutoffIso` variables
- Removed the `Archive` section entry
- Simplified `Completed` filter from `!!t.is_completed && !!t.completed_at && t.completed_at >= cutoffIso` to `!!t.is_completed`

- [ ] **Step 4: Run tests — confirm they pass**

Run: `pnpm test src/__tests__/todoLogic.test.ts`
Expected: all tests pass, including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/todoLogic.ts src/__tests__/todoLogic.test.ts
git commit -m "feat: remove hardcoded 7-day todo archive section; cutoff now governed by chat_days SQL filter"
```

---

## Task 2: TodoPanel completed-todo cutoff (TDD)

**Files:**
- Modify: `src/components/TodoPanel.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Add failing tests to TodoPanel.test.ts**

Open `src/__tests__/components/TodoPanel.test.ts` and add these two tests inside the existing `describe('TodoPanel', ...)` block, after the last existing `it(...)` call:

```typescript
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
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/__tests__/components/TodoPanel.test.ts`
Expected: the two new tests fail — current `load()` uses `SELECT * FROM todos ORDER BY` with no `completed_at` filter.

- [ ] **Step 3: Implement TodoPanel changes**

In `src/components/TodoPanel.ts`:

**3a.** Add a `private cutoffDays: number | undefined;` field after the existing private fields at the top of the class:

```typescript
export class TodoPanel {
  private listEl: HTMLElement;
  private countEl: HTMLElement;
  private onComplete: (() => void) | null = null;
  private cutoffDays: number | undefined;
```

**3b.** Replace the existing `load()` method with:

```typescript
async load(days?: number): Promise<void> {
  if (days !== undefined) this.cutoffDays = days;

  let todos: TodoItem[];
  if (this.cutoffDays !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - this.cutoffDays);
    const cutoff = d.toISOString().split('T')[0];
    todos = await query<TodoItem>(
      'SELECT * FROM todos WHERE is_completed = 0 OR (is_completed = 1 AND completed_at >= ?) ORDER BY is_important DESC, CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at ASC',
      [cutoff]
    );
  } else {
    todos = await query<TodoItem>(
      'SELECT * FROM todos ORDER BY is_important DESC, CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at ASC'
    );
  }
  this.render(todos);
}
```

- [ ] **Step 4: Run tests — confirm all pass**

Run: `pnpm test src/__tests__/components/TodoPanel.test.ts`
Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoPanel.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: todo panel hides completed todos older than chat_days"
```

---

## Task 3: SettingsModal onSave callback (TDD)

**Files:**
- Modify: `src/components/SettingsModal.ts`
- Modify: `src/__tests__/components/SettingsModal.test.ts`

- [ ] **Step 1: Add failing tests to SettingsModal.test.ts**

Open `src/__tests__/components/SettingsModal.test.ts`. Add this import at the top, after the existing imports (you will need `getSettingMock` to already return a value — the tests mock `getSetting` to return `null` by default so `chatDays` falls back to `3`):

Add these two tests inside the existing `describe('SettingsModal', ...)` block, after the last existing `it(...)`:

```typescript
it('setOnSave callback is invoked after a valid settings save', async () => {
  const onSave = vi.fn();
  // Access the SettingsModal instance via the save button's click path.
  // We register the callback by importing SettingsModal directly and registering
  // on the same DOM instance the app wired up. Instead, test end-to-end:
  // simulate a settings save that triggers applyChatDays() → sidebar refresh.

  // After saving with chat_days=5, applyChatDays reads from DB and calls sidebar.refresh(5).
  getSettingMock.mockImplementation(async (key: string) => {
    if (key === 'chat_days') return '5';
    return null;
  });

  await openSettings();
  (document.getElementById('apiKeyInput') as HTMLInputElement).value = 'sk-valid';
  (document.getElementById('llmModelInput') as HTMLInputElement).value = 'claude-haiku-4-5-20251001';
  (document.getElementById('chatDaysInput') as HTMLInputElement).value = '5';

  vi.clearAllMocks();
  queryMock.mockResolvedValue([]);
  getSettingMock.mockImplementation(async (key: string) => {
    if (key === 'chat_days') return '5';
    return null;
  });

  document.getElementById('saveSettingsBtn')!.click();
  await new Promise(r => setTimeout(r, 50));

  const sidebarCall = queryMock.mock.calls.find(([sql]) =>
    String(sql).includes('log_entries') && String(sql).includes('LIMIT')
  );
  expect(sidebarCall).toBeDefined();
  expect(sidebarCall![1]).toEqual([5]);
});

it('onSave callback is NOT invoked when save is called with empty API key', async () => {
  getSettingMock.mockResolvedValue(null);
  await openSettings();
  // apiKeyInput is empty (reset in beforeEach)

  vi.clearAllMocks();
  queryMock.mockResolvedValue([]);

  document.getElementById('saveSettingsBtn')!.click();
  await new Promise(r => setTimeout(r, 50));

  // sidebar refresh (LIMIT query) should NOT have been called
  const sidebarCall = queryMock.mock.calls.find(([sql]) =>
    String(sql).includes('log_entries') && String(sql).includes('LIMIT')
  );
  expect(sidebarCall).toBeUndefined();
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/__tests__/components/SettingsModal.test.ts`
Expected: the two new tests fail — `SettingsModal` has no `setOnSave` and `App` doesn't call `applyChatDays()` on save yet.

- [ ] **Step 3: Implement SettingsModal changes**

In `src/components/SettingsModal.ts`:

**3a.** Add a private field after `private chatDaysInput`:

```typescript
private onSaveCallback: (() => void) | null = null;
```

**3b.** Add a new public method after the `close()` method:

```typescript
setOnSave(cb: () => void): void {
  this.onSaveCallback = cb;
}
```

**3c.** In the existing `save()` method, add a call to `this.onSaveCallback?.()` as the final line of the non-empty-apiKey branch (just before the closing brace of the outer `if (!apiKey)` else path). The save method currently ends with:

```typescript
    await setSetting('chat_days', chatDays);

    this.close();
  }
```

Change it to:

```typescript
    await setSetting('chat_days', chatDays);

    this.close();
    this.onSaveCallback?.();
  }
```

- [ ] **Step 4: Run tests — confirm they still fail (App not wired yet)**

Run: `pnpm test src/__tests__/components/SettingsModal.test.ts`
Expected: the wiring tests still fail because `App` doesn't call `setOnSave` yet (Task 4 does this).

- [ ] **Step 5: Commit SettingsModal only**

```bash
git add src/components/SettingsModal.ts
git commit -m "feat: add setOnSave callback to SettingsModal"
```

---

## Task 4: App wiring

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Add `chatDays` field and `applyChatDays()` method**

In `src/app.ts`, after the `readonly ready: Promise<void>;` field declaration, add:

```typescript
private chatDays: number = 3;
```

After the constructor closing brace `}`, add the `applyChatDays` method:

```typescript
private async applyChatDays(): Promise<void> {
  this.chatDays = parseInt((await getSetting('chat_days')) ?? '3') || 3;
  await this.sidebar.refresh(this.chatDays);
  await this.todoPanel.load(this.chatDays);
}
```

- [ ] **Step 2: Update `init()` to call `applyChatDays()`**

Replace the existing `init()` method:

```typescript
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
```

with:

```typescript
private async init(): Promise<void> {
  try {
    await this.applyChatDays();
    await this.loadRecentEntries(this.chatDays);
    await getAdapter();
  } catch (err) {
    console.error('Startup load failed:', err);
    this.chatArea.append({
      time: '--:--', type: 'system', typeLabel: 'System',
      content: 'Failed to load data. Please restart the app.',
    });
  }
}
```

- [ ] **Step 3: Wire `setOnSave` in the constructor**

In the `App` constructor, after `this.inputHandler = new InputHandler(...)`, add:

```typescript
this.settings.setOnSave(() => { void this.applyChatDays(); });
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass, including the new Sidebar, TodoPanel, and SettingsModal wiring tests.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat: wire chat_days into sidebar and todo panel via applyChatDays"
```

---

## Task 5: Manual Verification

**Files:** none (dev server only)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Open `http://localhost:1420`.

- [ ] **Step 2: Verify sidebar respects chat_days**

Open Settings (gear icon). Set "Show days" to `2`. Save.
Expected: sidebar immediately shows at most 2 days. Any older days are no longer listed.

- [ ] **Step 3: Verify sidebar respects increased chat_days**

Open Settings. Set "Show days" to `10`. Save.
Expected: sidebar immediately shows up to 10 days of history.

- [ ] **Step 4: Verify completed todo cutoff**

Open Settings. Set "Show days" to `1`. Save.
Complete a new todo. It should appear in the Completed section.
Open Settings. Set "Show days" to `1` (no change, just to force a re-load). Save.
Expected: the todo you just completed is still visible (completed today, within 1 day).

- [ ] **Step 5: Verify old completions are hidden**

Open the DB (via sqlite CLI or tauri plugin dev tools) and manually update a todo's `completed_at` to a date 10 days ago. Then open Settings, set "Show days" to `3`, save. That todo should no longer appear in the Completed section.

- [ ] **Step 6: Verify no restart required**

Change "Show days" between values in Settings and confirm sidebar and todos update immediately each time without restarting the app.

- [ ] **Step 7: Commit any fixes**

```bash
git add -p
git commit -m "fix: x-days cutoff manual verification fixes"
```
