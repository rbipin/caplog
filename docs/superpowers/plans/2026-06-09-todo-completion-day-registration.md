# Todo Completion Day Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Days where todos are completed but no log entries exist should appear in the sidebar, chat feed, and archive — with completed todos rendered with strikethrough.

**Architecture:** Targeted query fixes in each affected file: `Sidebar.ts` gets a UNION query to surface todos-only days; `app.ts` unions date sources and emits strikethrough feed items for completed todos; `archiveUtils.ts` iterates `doneCounts` in addition to `entryCounts`; `ArchiveModal.ts` updates its empty-day check; `types.ts` adds `'todo-completed'` to `MessageType` and `FeedItem`; `styles.css` adds the new type's label colour. No DB schema changes.

**Tech Stack:** TypeScript, Vitest, SQLite (via Tauri IPC), Vite/ESM

---

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `'todo-completed'` to `MessageType`; add `todo-completed` variant to `FeedItem` |
| `src/styles.css` | Add `.msg-type.todo-completed` colour rule |
| `src/archiveUtils.ts` | Second loop over `doneCounts` in `buildWeeks` |
| `src/components/ArchiveModal.ts` | Update `isEmpty` check and tile count label in `renderDayTile` |
| `src/components/Sidebar.ts` | UNION query in `load()` |
| `src/app.ts` | UNION date query + completed-today feed logic in `loadRecentEntries` |
| `src/__tests__/archiveUtils.test.ts` | New unit test file for `buildWeeks` |
| `src/__tests__/components/Sidebar.test.ts` | Update + extend tests for UNION query |
| `src/__tests__/components/ArchiveModal.test.ts` | Add test for todos-only day tile |

---

## Task 1: Add `'todo-completed'` to types and styles

**Files:**
- Modify: `src/types.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Update `MessageType` and `FeedItem` in `src/types.ts`**

Replace:
```ts
export type MessageType = 'log' | 'todo-created' | 'system';
```
With:
```ts
export type MessageType = 'log' | 'todo-created' | 'todo-completed' | 'system';
```

Replace:
```ts
export type FeedItem =
  | { created_at: string; kind: 'log'; entry: LogEntry }
  | { created_at: string; kind: 'todo'; todo: TodoItem };
```
With:
```ts
export type FeedItem =
  | { created_at: string; kind: 'log'; entry: LogEntry }
  | { created_at: string; kind: 'todo'; todo: TodoItem }
  | { created_at: string; kind: 'todo-completed'; todo: TodoItem };
```

- [ ] **Step 2: Add CSS rule for `todo-completed` label colour in `src/styles.css`**

After the line:
```css
.msg-type.todo-created { color: var(--green); }
```
Add:
```css
.msg-type.todo-completed { color: var(--green); }
```

- [ ] **Step 3: Run type-check to confirm no errors**

Run: `pnpm build`
Expected: exits 0 with no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/styles.css
git commit -m "feat: add todo-completed MessageType and FeedItem variant"
```

---

## Task 2: Fix `buildWeeks` in `archiveUtils.ts`

**Files:**
- Modify: `src/archiveUtils.ts`
- Create: `src/__tests__/archiveUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/archiveUtils.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildWeeks } from '../archiveUtils.js';

describe('buildWeeks', () => {
  it('includes a day that has only completed todos and no log entries', () => {
    const entryCounts = {};
    const doneCounts = { '2026-06-03': 2 };
    const weeks = buildWeeks(entryCounts, doneCounts, 2026);

    const allDays = Array.from(weeks.values()).flatMap(w => w.days);
    const day = allDays.find(d => d.date === '2026-06-03');
    expect(day).toBeDefined();
    expect(day!.entryCount).toBe(0);
    expect(day!.doneCount).toBe(2);
  });

  it('does not duplicate a day that has both log entries and completed todos', () => {
    const entryCounts = { '2026-06-03': 4 };
    const doneCounts = { '2026-06-03': 1 };
    const weeks = buildWeeks(entryCounts, doneCounts, 2026);

    const allDays = Array.from(weeks.values()).flatMap(w => w.days);
    const matches = allDays.filter(d => d.date === '2026-06-03');
    expect(matches).toHaveLength(1);
    expect(matches[0].entryCount).toBe(4);
    expect(matches[0].doneCount).toBe(1);
  });

  it('counts totalDone correctly for todos-only days', () => {
    const entryCounts = {};
    const doneCounts = { '2026-06-03': 3 };
    const weeks = buildWeeks(entryCounts, doneCounts, 2026);

    const week = Array.from(weeks.values())[0];
    expect(week.totalDone).toBe(3);
    expect(week.totalEntries).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test archiveUtils --run`
Expected: FAIL — `'2026-06-03'` not found in days

- [ ] **Step 3: Add the `doneCounts` loop to `buildWeeks` in `src/archiveUtils.ts`**

After the existing `for (const [date, entryCount] of Object.entries(entryCounts))` loop and before the filler-days loop, add:

```ts
for (const [date, doneCount] of Object.entries(doneCounts)) {
  const weekStart = getWeekStart(date);
  if (!weeks.has(weekStart)) {
    weeks.set(weekStart, { weekStart, days: [], totalEntries: 0, totalDone: 0 });
  }
  const week = weeks.get(weekStart)!;
  if (!week.days.find(d => d.date === date)) {
    week.days.push({ date, entryCount: 0, doneCount });
    week.totalDone += doneCount;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test archiveUtils --run`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add src/archiveUtils.ts src/__tests__/archiveUtils.test.ts
git commit -m "feat: include todos-only days in archive buildWeeks"
```

---

## Task 3: Fix `renderDayTile` in `ArchiveModal.ts`

**Files:**
- Modify: `src/components/ArchiveModal.ts`
- Modify: `src/__tests__/components/ArchiveModal.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe('ArchiveModal')` block in `src/__tests__/components/ArchiveModal.test.ts`:

```ts
it('renders a non-empty tile for a day with only completed todos', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    // No log entries
    if (sql.includes('log_entries') && sql.includes('COUNT')) return [];
    // One day with completed todos
    if (sql.includes('DATE(completed_at)') && sql.includes('GROUP BY')) {
      return [{ date: '2026-06-04', done_count: 2 }];
    }
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  const tile = document.querySelector<HTMLElement>('.archive-day-tile[data-date="2026-06-04"]');
  expect(tile).not.toBeNull();
  expect(tile!.classList.contains('empty')).toBe(false);
  expect(tile!.textContent).toContain('2 done');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ArchiveModal --run`
Expected: FAIL — tile not found or has `empty` class

- [ ] **Step 3: Update `renderDayTile` in `src/components/ArchiveModal.ts`**

Change:
```ts
const isEmpty = day.entryCount === 0;
```
To:
```ts
const isEmpty = day.entryCount === 0 && day.doneCount === 0;
```

Change the count label line from:
```ts
<div class="archive-day-count">${isEmpty ? '—' : `${day.entryCount} entries`}</div>
```
To:
```ts
<div class="archive-day-count">${isEmpty ? '—' : day.entryCount > 0 ? `${day.entryCount} entries` : `${day.doneCount} done`}</div>
```

- [ ] **Step 4: Run all tests to verify**

Run: `pnpm test --run`
Expected: all existing + new test pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ArchiveModal.ts src/__tests__/components/ArchiveModal.test.ts
git commit -m "feat: show todos-only days as non-empty tiles in archive"
```

---

## Task 4: Fix Sidebar query

**Files:**
- Modify: `src/components/Sidebar.ts`
- Modify: `src/__tests__/components/Sidebar.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe('Sidebar')` block in `src/__tests__/components/Sidebar.test.ts`:

```ts
it('renders a day entry for a day that has only completed todos and no log entries', async () => {
  queryMock.mockResolvedValue([{
    date: '2026-06-04',
    log_count: 0,
    todo_done_count: 2,
    preview: 'Fix the login bug',
  }]);
  const sidebar = new Sidebar(vi.fn());
  await sidebar.refresh(3);

  const entries = document.querySelectorAll('.day-entry');
  expect(entries.length).toBe(1);
  const preview = entries[0].querySelector('.day-entry-preview');
  expect(preview!.textContent).toBe('Fix the login bug');
  const doneTags = entries[0].querySelectorAll('.tag-todo');
  expect(doneTags.length).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test Sidebar --run`
Expected: PASS already (it mocks the query result) — this test validates the render logic is correct for todos-only days. The query change is validated by the next steps.

- [ ] **Step 3: Rewrite `load()` in `src/components/Sidebar.ts` with the UNION query**

Replace the existing `load()` method body with:

```ts
private async load(): Promise<void> {
  const stats = await query<DayStats>(`
    SELECT date, log_count, todo_done_count, preview FROM (
      SELECT
        l.date,
        COUNT(l.id) AS log_count,
        (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
        (SELECT formatted_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
      FROM log_entries l
      GROUP BY l.date

      UNION

      SELECT
        DATE(t.completed_at) AS date,
        0 AS log_count,
        COUNT(*) AS todo_done_count,
        (SELECT text FROM todos WHERE DATE(completed_at) = DATE(t.completed_at) ORDER BY completed_at ASC LIMIT 1) AS preview
      FROM todos t
      WHERE t.completed_at IS NOT NULL
        AND DATE(t.completed_at) NOT IN (SELECT date FROM log_entries)
      GROUP BY DATE(t.completed_at)
    )
    ORDER BY date DESC
    LIMIT ?
  `, [this.days]);

  this.dayList.innerHTML = '';
  stats.forEach((s, i) => this.dayList.appendChild(this.renderEntry(s, i === 0)));
}
```

- [ ] **Step 4: Update existing Sidebar tests to match UNION query**

In `src/__tests__/components/Sidebar.test.ts`, the three existing tests find the query call with `.includes('log_entries') && .includes('LIMIT')`. The UNION query still contains both strings, so those assertions still pass. No change needed.

- [ ] **Step 5: Run all Sidebar tests**

Run: `pnpm test Sidebar --run`
Expected: all 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.ts src/__tests__/components/Sidebar.test.ts
git commit -m "feat: show todos-only days in sidebar via UNION query"
```

---

## Task 5: Fix `loadRecentEntries` in `app.ts`

**Files:**
- Modify: `src/app.ts`
- Modify: `src/__tests__/components/ChatArea.test.ts`

- [ ] **Step 1: Write the failing test — verify date query uses UNION**

In `src/__tests__/components/ChatArea.test.ts`, find the `describe('ChatArea')` block and add:

```ts
it('issues a UNION date query that includes completed_at when loading entries', async () => {
  // The startup loadRecentEntries already ran in beforeAll.
  // Check that at least one call to queryMock contained the UNION pattern.
  const unionCall = queryMock.mock.calls.find(
    ([sql]: [string]) => String(sql).includes('UNION') && String(sql).includes('completed_at')
  );
  expect(unionCall).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ChatArea --run`
Expected: FAIL — no call to `queryMock` with `UNION` + `completed_at` yet

- [ ] **Step 3: Write a test for strikethrough rendering of a completed todo**

Add to `describe('ChatArea')`:

```ts
it('renders a todo-completed message with strikethrough content and correct type label', async () => {
  const { ChatArea } = await import('../../components/ChatArea.js');
  const area = document.getElementById('chatArea')!;
  const previousContent = area.innerHTML;
  const ca = new ChatArea();
  ca.append({
    time: '10:00',
    type: 'todo-completed',
    typeLabel: 'Todo completed',
    content: '<s>Deploy hotfix</s>',
  });
  const newMsg = area.querySelector('.msg:last-child');
  expect(newMsg).not.toBeNull();
  const msgType = newMsg!.querySelector('.msg-type.todo-completed');
  expect(msgType).not.toBeNull();
  expect(msgType!.textContent).toBe('Todo completed');
  const msgContent = newMsg!.querySelector('.msg-content');
  expect(msgContent!.innerHTML).toBe('<s>Deploy hotfix</s>');
  area.innerHTML = previousContent; // restore
});
```

- [ ] **Step 4: Run to verify Step 3 test passes (ChatArea.append already handles new types)**

Run: `pnpm test ChatArea --run`
Expected: Step 1 test still FAILS (no UNION yet); Step 3 test PASSES

- [ ] **Step 5: Update `loadRecentEntries` in `src/app.ts`**

Replace the date collection block:
```ts
const dateRows = await query<{ date: string }>(
  'SELECT DISTINCT date FROM log_entries WHERE date >= ? ORDER BY date DESC',
  [cutoffDate]
);
```
With:
```ts
const dateRows = await query<{ date: string }>(
  `SELECT date FROM log_entries WHERE date >= ?
   UNION
   SELECT DATE(completed_at) AS date FROM todos
   WHERE completed_at >= ? AND completed_at IS NOT NULL
   ORDER BY date DESC`,
  [cutoffDate, cutoffDate]
);
```

Replace the per-day data loading and feed-building block:
```ts
const [entries, todos] = await Promise.all([
  query<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC', [date]),
  query<TodoItem>('SELECT * FROM todos WHERE created_at LIKE ? ORDER BY created_at ASC', [date + '%']),
]);

const items: FeedItem[] = [
  ...entries.map((e) => ({ created_at: e.created_at, kind: 'log' as const, entry: e })),
  ...todos.map((t) => ({ created_at: t.created_at, kind: 'todo' as const, todo: t })),
].sort((a, b) => a.created_at.localeCompare(b.created_at));

for (const item of items) {
  if (item.kind === 'log') {
    const e = item.entry;
    const time = formatTime(e.created_at);
    this.chatArea.append({
      time, type: 'log', typeLabel: 'Log entry',
      content: e.formatted_text,
      rawInput: e.raw_text !== e.formatted_text ? stripHtml(e.formatted_text) : undefined,
      entryId: e.id,
    }, false);
  } else {
    const t = item.todo;
    const time = formatTime(t.created_at);
    const typeLabel = t.deadline ? `Todo created — due ${t.deadline}` : 'Todo created';
    this.chatArea.append({ time, type: 'todo-created', typeLabel, content: escapeHtml(t.text) }, false);
  }
}
```
With:
```ts
const [entries, createdTodos, completedTodos] = await Promise.all([
  query<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC', [date]),
  query<TodoItem>('SELECT * FROM todos WHERE created_at LIKE ? ORDER BY created_at ASC', [date + '%']),
  query<TodoItem>('SELECT * FROM todos WHERE DATE(completed_at) = ? ORDER BY completed_at ASC', [date]),
]);

const completedTodayIds = new Set(completedTodos.map((t) => t.id));

const items: FeedItem[] = [
  ...entries.map((e) => ({ created_at: e.created_at, kind: 'log' as const, entry: e })),
  ...createdTodos.map((t) => ({ created_at: t.created_at, kind: 'todo' as const, todo: t })),
  ...completedTodos
    .filter((t) => !t.created_at.startsWith(date))
    .map((t) => ({ created_at: t.completed_at!, kind: 'todo-completed' as const, todo: t })),
].sort((a, b) => a.created_at.localeCompare(b.created_at));

for (const item of items) {
  if (item.kind === 'log') {
    const e = item.entry;
    const time = formatTime(e.created_at);
    this.chatArea.append({
      time, type: 'log', typeLabel: 'Log entry',
      content: e.formatted_text,
      rawInput: e.raw_text !== e.formatted_text ? stripHtml(e.formatted_text) : undefined,
      entryId: e.id,
    }, false);
  } else if (item.kind === 'todo') {
    const t = item.todo;
    const time = formatTime(t.created_at);
    if (completedTodayIds.has(t.id)) {
      this.chatArea.append({
        time, type: 'todo-completed', typeLabel: 'Todo completed',
        content: `<s>${escapeHtml(t.text)}</s>`,
      }, false);
    } else {
      const typeLabel = t.deadline ? `Todo created — due ${t.deadline}` : 'Todo created';
      this.chatArea.append({ time, type: 'todo-created', typeLabel, content: escapeHtml(t.text) }, false);
    }
  } else {
    const t = item.todo;
    const time = formatTime(t.completed_at!);
    this.chatArea.append({
      time, type: 'todo-completed', typeLabel: 'Todo completed',
      content: `<s>${escapeHtml(t.text)}</s>`,
    }, false);
  }
}
```

- [ ] **Step 6: Run type-check**

Run: `pnpm build`
Expected: exits 0

- [ ] **Step 7: Run full test suite**

Run: `pnpm test --run`
Expected: all tests pass, including the Step 1 UNION query test now passing

- [ ] **Step 8: Commit**

```bash
git add src/app.ts src/__tests__/components/ChatArea.test.ts
git commit -m "feat: include todos-only days in chat feed with strikethrough completed items"
```

---

## Task 6: Code review pass

After all tasks above are committed, run the code-review skill to check for efficiency, simplicity, and readability:

- [ ] **Step 1: Invoke code review**

Run: `/code-review` (or `superpowers:requesting-code-review`) against the current branch diff

- [ ] **Step 2: Apply any actionable findings**

Address efficiency, simplicity, and readability findings from the review. Commit fixes.

---

## Verification Checklist

After all tasks:

- [ ] `pnpm test --run` — all tests green
- [ ] `pnpm build` — type-check passes
- [ ] Manual smoke test: complete a todo on a day with no log entries, verify it appears in sidebar, chat feed, and archive
- [ ] Manual smoke test: complete a todo created on a previous day — verify it appears as a new strikethrough entry in today's chat section
