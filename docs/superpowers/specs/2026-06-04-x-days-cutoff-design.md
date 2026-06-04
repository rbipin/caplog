# X-Days Cutoff — Design Spec

**Date:** 2026-06-04
**Status:** Pending

## Problem

The `chat_days` setting (default `3`, range `1–14`) already controls how many days of log entries appear in the ChatArea. The sidebar ignores it (hardcoded `LIMIT 30`) and the TodoPanel shows all completed todos regardless of age. Users expect the same cutoff to govern all three views consistently.

## Decision

Wire `chat_days` into `Sidebar` and `TodoPanel` using Option B: `App` owns `chatDays` as a single source of truth, reads it from the DB on startup and on settings save, and passes it down to both components. `SettingsModal` gains an `onSave` callback so changes take effect immediately without a restart.

## Feature 1: Sidebar Cutoff

### What changes

`Sidebar.refresh()` gains an optional `days` parameter: `refresh(days?: number)`. When `days` is supplied the component stores it internally; subsequent calls without a parameter reuse the stored value. This means internal refreshes (e.g. after a new log entry is saved) continue to work without `App` re-passing the value each time.

The SQL query changes from the hardcoded `LIMIT 30` to `LIMIT ?` with `chatDays` as the bind parameter. Everything else in the query — columns, ordering, subqueries — is unchanged.

### Sidebar behavior

- Sidebar shows the `chatDays` most recent calendar days that have at least one log entry.
- Days beyond the cutoff are not shown. The existing Archive button (from the archive navigation feature) is the entry point for older history. No additional hint or count is shown in the sidebar.
- Default value (`chat_days` not set in DB): `3`, matching the existing fallback in `App`.

## Feature 2: Completed Todos Cutoff

### What changes

`TodoPanel.load()` gains an optional `days` parameter: `load(days?: number)`. The value is stored internally for the same reason as Sidebar. Internal reloads triggered by completing, reopening, or deleting a todo reuse the stored value automatically.

When `days` is provided, the query filters completed todos by `completed_at`:

```sql
SELECT * FROM todos
WHERE is_completed = 0
   OR (is_completed = 1 AND completed_at >= ?)
ORDER BY is_important DESC,
         CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
         deadline ASC,
         created_at ASC
```

The cutoff date is computed in TypeScript before the query: subtract `days` calendar days from today in `YYYY-MM-DD` format and pass it as a bind parameter. Open todos are never filtered. If `days` is not provided (e.g. during unit tests that don't pass a value) all completed todos are shown, preserving backward compatibility.

### Todo panel behavior

- Completed todos with `completed_at` before the cutoff date are silently hidden.
- The Completed `<details>` section disappears entirely if no completed todos fall within the window.
- The header count (`N open · M done`) reflects only visible completed todos.
- Old completed todos remain in the DB and are visible when the user navigates to that day in the archive (via `LogModal.openDay`, which already shows todos for a day).
- No hint is shown in the todo panel about hidden completions.

## Common Wiring

### `App`

`App` gains a `private chatDays: number` field initialized to `3`. A new private method `private async applyChatDays(): Promise<void>` reads `chat_days` from DB, sets `this.chatDays`, and calls:

```typescript
this.sidebar.refresh(this.chatDays);
await this.todoPanel.load(this.chatDays);
```

`App.init()` calls `applyChatDays()` instead of the current inline read. The `SettingsModal` `onSave` callback also calls `applyChatDays()`.

### `SettingsModal`

A new `setOnSave(cb: () => void)` method stores the callback. The existing `save()` method calls it at the end (after writing to DB). The callback is only called when save succeeds (i.e. when `apiKey` is non-empty; the delete-all-settings branch just closes without a reload since there is no meaningful `chatDays` to apply).

`App` calls `this.settings.setOnSave(() => { void this.applyChatDays(); })` during construction.

## Out of Scope

- Live-reloading the ChatArea when settings change (it already reflects the correct value on startup; a full reload would flicker the feed)
- Showing a count of hidden items in either the sidebar or the todo panel
- Surfacing completed todos in a dedicated archive section separate from their day's log entries
- Changing the `chat_days` range or default value
