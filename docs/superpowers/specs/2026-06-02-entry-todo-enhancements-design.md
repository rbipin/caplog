# Design: Entry & Todo Enhancements

**Date:** 2026-06-02

## Overview

Five enhancements to DayLog's core UX:

1. Delete a log entry (any day)
2. Click a sidebar day to open that day's log + todos in a modal
3. Chat area shows multiple days (configurable, default 3), with past days collapsible
4. Uncheck a completed todo to reopen it
5. Inline edit a todo's text in place

---

## 1. Data & DB

No schema changes for features 1, 2, 4, or 5. All required columns already exist.

**New migration: `002_settings_chat_days.sql`**

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_days', '3');
```

Seeds the default value. The existing `settings` table (key/value) handles it without new columns.

`App.init()` reads `getSetting('chat_days')` at startup and passes the parsed integer to `loadRecentEntries()`.

---

## 2. ChatArea — Multi-day feed + delete

### Multi-day loading

`loadTodayEntries()` → renamed `loadRecentEntries(days: number)`.

- Queries `log_entries` for the last `N` distinct dates (DESC), then loads them oldest-first so today renders at the top of the feed.

### Collapsible day sections

`appendDivider()` → replaced by `appendDaySection(dateLabel: string, isToday: boolean)`.

- Renders a `<details>` element. Today's section: `open` attribute set. Past days: collapsed by default.
- The `<summary>` is the existing day-divider label style (e.g. "Today — Jun 2", "Yesterday — Jun 1").
- Each day's entries are appended as children of the `<details>` block.

Visual structure:
```
▼ Today — Jun 2       ← open
  [entries]
▶ Yesterday — Jun 1   ← collapsed
▶ Sat — May 31        ← collapsed
```

### Delete button on log entries

- Each `.msg` element with an `entryId` gets a `✕` button (same markup class as `todo-delete-btn`).
- Hidden by default; revealed on `.msg:hover` via CSS.
- On click: `execute('DELETE FROM log_entries WHERE id = ?', [entryId])`, remove the DOM node, call `sidebar.refresh()`.
- Not rendered on system or todo-created messages (no `entryId`).

### Wiring

`ChatArea` accepts a `onSidebarRefresh: () => void` callback (set via a setter or constructor param), consistent with how `InputHandler` takes `onSubmit`. `App` wires `() => sidebar.refresh()` to it.

---

## 3. Sidebar — Click to open day modal

### `Sidebar.ts`

`renderEntry()` fires an `onDaySelect(date: string)` callback on click (ISO date string, e.g. `"2026-06-01"`). Callback is passed into the `Sidebar` constructor.

Active CSS class toggling is retained.

### `LogModal.ts` — extended for day view

`LogModal.open()` is extended to accept an optional `todos: TodoItem[]` parameter alongside the existing entries data.

Modal renders two sections for the selected day:

```
── Monday, Jun 1 ──────────────────
Log Entries
  14:32  worked on feature X
  15:10  fixed the deploy issue

Todos
  ☑ finish report
  ☐ review PR
```

- Todos fetched by `created_at LIKE date || '%'` (same query already used in sidebar stats).
- Completed todos: show ✓. Open todos: show ☐.
- Read-only — no interaction within the modal.

### `App.ts`

Passes `onDaySelect` to `Sidebar`. Handler queries `log_entries` and `todos` for that date, then calls `modal.open()` with both datasets.

---

## 4. TodoPanel — Uncheck + inline edit

### Uncheck completed todo

`renderItem()` is updated so completed todos get a click listener on `.todo-check`:

```ts
async reopen(id: number): Promise<void> {
  await execute('UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?', [id]);
  await this.load();
}
```

- `.todo-check` gets `cursor: pointer` and a hover style when the todo is completed.
- Clicking `.todo-check` on a completed todo calls `reopen()` instead of `complete()`.

### Inline edit todo text

Clicking `.todo-text` on an **incomplete** todo enters edit mode:

- Replace `.todo-text` content with a `<textarea>` pre-filled with `todo.text`.
- Save/Cancel buttons rendered below textarea.
- Save: `execute('UPDATE todos SET text = ? WHERE id = ?', [newText, id])`, then `this.load()`.
- Cancel: restore original text content.
- `Enter` key saves; `Escape` cancels.
- If a textarea is already present (edit already active), the click handler is a no-op.
- Completed todos are not editable.
- Clicks on `.todo-delete-btn` or `.todo-check` while editing are not intercepted by the edit handler (existing stopPropagation on those buttons is sufficient).

---

## 5. Settings — Chat day count

### `SettingsModal.ts`

Add a numeric input labelled "Days to show in chat" to the settings form:

- Min: 1, Max: 14, Default: 3.
- Reads from `getSetting('chat_days')` on `open()`.
- Writes via `setSetting('chat_days', value)` on save.

Change takes effect on next app launch (no live reload required).

---

## Components Touched

| File | Change |
|------|--------|
| `src-tauri/migrations/002_settings_chat_days.sql` | New — seeds `chat_days = 3` |
| `src/app.ts` | `loadRecentEntries(days)`, wire `onDaySelect`, wire `onSidebarRefresh` |
| `src/components/ChatArea.ts` | `appendDaySection`, delete button, `onSidebarRefresh` callback |
| `src/components/Sidebar.ts` | `onDaySelect` callback in constructor + `renderEntry` |
| `src/components/LogModal.ts` | Accept + render todos for day view |
| `src/components/TodoPanel.ts` | `reopen()`, click-to-edit on todo text |
| `src/components/SettingsModal.ts` | `chat_days` field |
| `src/styles.css` | Hover styles for delete button on `.msg`, collapsible section styles, todo edit styles |

---

## Out of Scope

- Live reload when chat day count setting changes (restart is sufficient)
- Editing todos from within the day-view modal
- Bulk delete
