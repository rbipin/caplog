# Design: Todo Completion Day Registration

**Date:** 2026-06-09
**Branch:** fix-entry-for-todo-completion

## Problem

Days where todos are completed but no log entries exist are invisible in the sidebar, chat feed, and archive. Completing a todo is meaningful work that should be registered as activity for that day.

## Scope

Three surfaces need updating — no DB schema changes required:

1. **Sidebar** — days with only completed todos must appear with a preview
2. **Chat feed** — days with only completed todos get their own section; completed todos render with strikethrough
3. **Archive** — days with only completed todos appear as non-empty tiles

## Approach

Targeted query/logic fixes in each affected file. No new abstractions; each site has different filtering constraints that make a shared helper awkward.

---

## Section 1: Types (`src/types.ts`)

- Add `'todo-completed'` to `MessageType`.
- Add a `todo-completed` variant to the `FeedItem` union:
  ```ts
  | { created_at: string; kind: 'todo-completed'; todo: TodoItem }
  ```

---

## Section 2: Sidebar (`src/components/Sidebar.ts`)

Replace the `FROM log_entries` base query with a UNION wrapped in a subquery:

```sql
SELECT date, log_count, todo_done_count, preview
FROM (
  -- days with log entries
  SELECT
    l.date,
    COUNT(l.id) AS log_count,
    (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
    (SELECT formatted_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
  FROM log_entries l
  GROUP BY l.date

  UNION

  -- days with only completed todos, no log entries
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
```

No changes to `renderEntry` — `preview` already renders as plain text so a todo's text works unchanged.

---

## Section 3: Chat feed (`src/app.ts` → `loadRecentEntries`)

### Date collection

Replace:
```sql
SELECT DISTINCT date FROM log_entries WHERE date >= ? ORDER BY date DESC
```
With:
```sql
SELECT date FROM log_entries WHERE date >= ?
UNION
SELECT DATE(completed_at) AS date FROM todos WHERE completed_at >= ? AND completed_at IS NOT NULL
ORDER BY date DESC
```

Pass `cutoffDate` for both `?` parameters.

### Per-day feed building

For each date, fetch a third query alongside the existing two:
```sql
SELECT * FROM todos WHERE DATE(completed_at) = ? ORDER BY completed_at ASC
```

**Merge logic:**
1. Build a `Set<number>` of todo IDs completed that day (`completedTodayIds`).
2. When appending `todo-created` items: if the todo's ID is in `completedTodayIds`, render with strikethrough (same-day completion).
3. For each completed-today todo whose `created_at` date differs from the current day: emit a new `todo-completed` feed entry, sorted by `completed_at`, rendered with strikethrough.

### ChatArea rendering

`ChatArea.append()` already switches on `MessageType`. Add a `'todo-completed'` case that renders identically to `'todo-created'` but wraps the content in `<s>…</s>`.

---

## Section 4: Archive (`src/archiveUtils.ts` + `src/components/ArchiveModal.ts`)

### `buildWeeks` fix

After the existing `entryCounts` loop, add a second loop over `doneCounts`:

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

### `renderDayTile` fix

Change the empty check from:
```ts
const isEmpty = day.entryCount === 0;
```
To:
```ts
const isEmpty = day.entryCount === 0 && day.doneCount === 0;
```

For todos-only days, show "N done" instead of "N entries" in the tile count label.

---

## Post-implementation

After implementation, run a code review pass for efficiency, simplicity, and readability before merging.

## Files changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `'todo-completed'` to `MessageType`; add `todo-completed` to `FeedItem` |
| `src/components/Sidebar.ts` | UNION query in `load()` |
| `src/app.ts` | UNION date query + completed-today feed logic in `loadRecentEntries` |
| `src/components/ChatArea.ts` | Render `'todo-completed'` with strikethrough |
| `src/archiveUtils.ts` | Second loop over `doneCounts` in `buildWeeks` |
| `src/components/ArchiveModal.ts` | Update empty check in `renderDayTile` |
