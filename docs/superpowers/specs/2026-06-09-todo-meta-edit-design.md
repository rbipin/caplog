# Design: Todo Meta Edit (Deadline & Importance)

**Date:** 2026-06-09
**Branch:** fix-entry-for-todo-completion

## Problem

Once a todo is created, its deadline and importance cannot be changed. Users need to be able to update these fields after creation without deleting and re-creating the todo.

## Scope

Edit deadline and importance on **open (non-completed) todos only**. Completed todos are unchanged. Text editing of the todo body is unaffected.

---

## Approach

A new `startMetaEdit` method on `TodoPanel`, triggered by clickable chips rendered on every open todo. The chips are always visible (ghost state when empty, filled state when set). Clicking any chip opens a compact edit row below the todo. Text editing and meta editing are mutually exclusive.

No DB schema changes — `deadline TEXT` and `is_important INTEGER` already exist.

---

## Section 1: Data Model

No schema changes required.

**Save query:**
```sql
UPDATE todos SET deadline = ?, is_important = ? WHERE id = ?
```

- Empty deadline input → `null` (clears the deadline)
- `is_important` saved as `1` or `0`

---

## Section 2: Rendering (`TodoPanel.renderItem`)

Every **open** todo gets a `div.todo-chips` row below the text, containing two chips rendered unconditionally:

**Deadline chip:**
- `todo.deadline === null` → faint ghost chip: `+ due date` (dashed border, dim colour)
- `todo.deadline !== null` → filled chip: `due <value>` (existing deadline style)
- Both are clickable → trigger `startMetaEdit`

**Importance chip:**
- `todo.is_important === 0` → ghost chip: `☆ important`
- `todo.is_important === 1` → filled chip: `important` badge style
- Both are clickable → trigger `startMetaEdit`

The existing read-only section badges (`important`, `overdue`) in `metaHtml` are unchanged.

**Completed todos:** no chips, no edit row — unchanged from current behaviour.

---

## Section 3: `startMetaEdit` Interaction

```ts
private startMetaEdit(el: HTMLElement, todo: TodoItem): void
```

**Guard:** if `el.querySelector('div.todo-meta-edit')` exists, return (idempotent).

**Mutual exclusion:** if a text edit (`textarea.todo-edit-area`) is open on this element, restore `textEl.innerHTML` to its original HTML before proceeding.

**Edit row structure (`div.todo-meta-edit`):**
- Inserted immediately after the todo element's inner layout (appended to `el`)
- Contains:
  - Text input, `placeholder="due date (e.g. Jun 15)"`, pre-filled with `todo.deadline ?? ''`
  - Importance toggle button — displays `★ Important` (active) or `☆ Important` (inactive); toggled in memory on click, does not write to DB until Save
  - **Save** button
  - **Cancel** button (or Escape key)

**Save behaviour:**
- Runs `UPDATE todos SET deadline = ?, is_important = ? WHERE id = ?`
- Empty deadline input → `null`
- Calls `this.load()` to re-render the list
- Closes the edit row

**Cancel behaviour (Escape key or Cancel button):**
- Removes the edit row
- Does not call `execute`

---

## Section 4: Testing (`src/__tests__/components/TodoPanel.test.ts`)

| Test | Assertion |
|------|-----------|
| Ghost chips render on open todos | `+ due date` and `☆ important` chips in DOM for todo with no deadline, `is_important: 0` |
| Ghost chips absent on completed todos | Neither chip present for `is_completed: 1` todo |
| Existing deadline chip rendered | Chip shows `due <value>` (not ghost) when `todo.deadline` is set |
| `startMetaEdit` opens edit row | Click `+ due date` chip → `div.todo-meta-edit` appears with input and toggle |
| Edit row pre-fills existing deadline | Click chip on todo with deadline → input pre-filled with deadline value |
| Save updates DB | Simulate save → `execute` called with correct UPDATE SQL and params |
| Clearing deadline saves null | Save with empty input → `execute` called with `null` for deadline |
| Importance toggle flips state | Click toggle → displayed state changes (☆ ↔ ★) before saving |
| Mutual exclusion (text → meta) | Open text edit, click chip → text edit closed, meta edit open |
| Escape closes without saving | Open meta edit, press Escape → row removed, `execute` not called |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/TodoPanel.ts` | Add `div.todo-chips` to `renderItem`; add `startMetaEdit` method |
| `src/styles.css` | Add styles for `.todo-chips`, ghost chip states, `.todo-meta-edit` |
| `src/__tests__/components/TodoPanel.test.ts` | Add 10 new tests |
