# Design: Entry & Todo Enhancements

**Date:** 2026-06-02

## Overview

Eight enhancements to CapLog's core UX:

1. Delete a log entry (any day)
2. Click a sidebar day to open that day's log + todos completed that day in a modal
3. Chat area shows multiple days (configurable, default 3), with past days collapsible
4. Uncheck a completed todo to reopen it
5. Inline edit a todo's text in place
6. Chat area persists todo-created messages across app restarts
7. Day-view modal shows todos completed that day (not just created)
8. Completed todos older than 7 days collapse into an Archive section in the todo panel

---

## 1. Data & DB

No schema changes for features 1, 4, or 5. All required columns already exist.

**New migration: `002_settings_chat_days.sql`**

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_days', '3');
```

Seeds the default value. The existing `settings` table (key/value) handles it without new columns.

`App.init()` reads `getSetting('chat_days')` at startup and passes the parsed integer to `loadRecentEntries()`.

---

## 2. ChatArea — Multi-day feed + delete + todo persistence

### Multi-day loading

`loadTodayEntries()` → renamed `loadRecentEntries(days: number)`.

For each day in the window, the function queries both `log_entries` and `todos` for that date, merges them by `created_at` ascending, then renders them in chronological order. This restores the full picture of a day — including todo-created messages — after a restart.

- Log entries render as `type: 'log'` (with delete button and edit support).
- Todos render as `type: 'todo-created'` (label: "Todo created" or "Todo created — due DATE", content: escaped todo text). No delete button on these messages.
- The merged list is sorted by `created_at` so log entries and todos appear in the order they were added.

### Collapsible day sections

`appendDivider()` → replaced by `appendDaySection(dateLabel: string, isToday: boolean)`.

- Renders a `<details>` element. Today's section: `open` attribute set. Past days: collapsed by default.
- The `<summary>` uses the existing day-divider label style (e.g. "Today — Jun 2", "Yesterday — Jun 1").
- Each day's entries are appended as children of the `<details>` block.

Visual structure:

```
▼ Today — Jun 2       ← open
  [entries + todos interleaved]
▶ Yesterday — Jun 1   ← collapsed
▶ Sat — May 31        ← collapsed
```

### Delete button on log entries

- Each `.msg` element with an `entryId` gets a `✕` button (same markup class as `todo-delete-btn`).
- Hidden by default; revealed on `.msg:hover` via CSS.
- On click: `execute('DELETE FROM log_entries WHERE id = ?', [entryId])`, remove the DOM node, call `sidebar.refresh()`.
- Not rendered on system or todo-created messages (no `entryId`).

### Wiring

`ChatArea` accepts an `onSidebarRefresh: () => void` callback (set via a setter or constructor param), consistent with how `InputHandler` takes `onSubmit`. `App` wires `() => sidebar.refresh()` to it.

---

## 3. Sidebar — Click to open day modal

### `Sidebar.ts`

`renderEntry()` fires an `onDaySelect(date: string)` callback on click (ISO date string, e.g. `"2026-06-01"`). Callback is passed into the `Sidebar` constructor.

Active CSS class toggling is retained.

### `LogModal.ts` — extended for day view

`LogModal.open()` is extended to accept an optional `todos: TodoItem[]` parameter alongside the existing entries data.

The todos passed in are those **completed on that date** (queried by `completed_at LIKE date || '%'`), not those created on that date. This shows what was actually accomplished on that day regardless of when the todo was originally added.

Modal renders two sections for the selected day:

```
── Monday, Jun 1 ──────────────────
Log Entries
  14:32  worked on feature X
  15:10  fixed the deploy issue

Completed Todos
  ✓ finish report
  ✓ review PR
```

- Read-only — no interaction within the modal.
- If no todos were completed that day, the "Completed Todos" section is omitted.

### `App.ts`

Passes `onDaySelect` to `Sidebar`. Handler queries `log_entries` for entries on that date and `todos` where `completed_at LIKE date || '%'`, then calls `modal.open()` with both datasets.

---

## 4. TodoPanel — Uncheck + inline edit + archive

### Uncheck completed todo

`renderItem()` is updated so completed todos get a click listener on `.todo-check`:

```ts
async reopen(id: number): Promise<void> {
  await execute('UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?', [id]);
  await this.load();
}
```

- `.todo-check` gets `cursor: pointer` and a hover style when the todo is completed.
- Clicking `.todo-check` on a completed todo calls `reopen()`.

### Inline edit todo text

Clicking `.todo-text` on an **incomplete** todo enters edit mode:

- Replace `.todo-text` content with a `<textarea>` pre-filled with `todo.text`.
- Save/Cancel buttons rendered below textarea.
- Save: `execute('UPDATE todos SET text = ? WHERE id = ?', [newText, id])`, then `this.load()`.
- Cancel: restore original text content.
- `Enter` key saves; `Escape` cancels.
- If a textarea is already present (edit already active), the click handler is a no-op.
- Completed todos are not editable.
- Clicks on `.todo-delete-btn` or `.todo-check` while in edit mode are not intercepted by the edit handler (existing `stopPropagation` on those buttons is sufficient).

### Archive section for old completed todos

Completed todos are split into two groups by age of `completed_at`:

- **Recent completed** (within 7 days): shown in the existing "Completed" section as today.
- **Archived** (completed more than 7 days ago): shown in a new "Archive" section at the bottom of the todo panel, collapsed by default via `<details>`.

```
[ Important ]
  ...
[ Open ]
  ...
[ Completed ]
  ✓ recent done item
▶ Archive            ← collapsed <details>
  ✓ old done item
  ✓ older done item
```

The 7-day threshold is a compile-time constant (not user-configurable). Archived todos retain full functionality: they can be unchecked (reopen) and deleted. The archive count is shown in the `<summary>` label (e.g. "Archive (4)").

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
| `src/app.ts` | `loadRecentEntries(days)`, merge todos into feed, wire `onDaySelect`, wire `onSidebarRefresh` |
| `src/components/ChatArea.ts` | `appendDaySection`, delete button on log msgs, `onSidebarRefresh` callback |
| `src/components/Sidebar.ts` | `onDaySelect` callback in constructor and `renderEntry` |
| `src/components/LogModal.ts` | Accept + render todos completed that day |
| `src/components/TodoPanel.ts` | `reopen()`, click-to-edit, archive section |
| `src/components/SettingsModal.ts` | `chat_days` field |
| `src/styles.css` | Hover styles for msg delete button, collapsible section styles, todo edit + archive styles |

---

## Out of Scope

- Live reload when chat day count setting changes (restart is sufficient)
- Editing todos from within the day-view modal
- Bulk delete
- Configurable archive threshold (7 days is fixed)
