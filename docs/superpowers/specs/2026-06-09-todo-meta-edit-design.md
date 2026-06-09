# Design: Todo Meta Edit (Deadline & Importance)

**Date:** 2026-06-09
**Branch:** todo-update-post-creation

## Problem

Once a todo is created, its deadline and importance cannot be changed. Users need to be able to update these fields after creation without deleting and re-creating the todo.

## Scope

Edit deadline and importance on **open (non-completed) todos only**. Completed todos are unchanged. Text editing of the todo body is unaffected.

---

## Approach

Always-visible chips on every open todo. Clicking the importance chip is a **direct toggle** — no form needed. Clicking the deadline chip opens a compact inline edit row for text input. Text editing and deadline editing are mutually exclusive.

No DB schema changes — `deadline TEXT` and `is_important INTEGER` already exist.

---

## Section 1: Data Model

No schema changes required.

**Importance save query:**
```sql
UPDATE todos SET is_important = ? WHERE id = ?
```

**Deadline save query:**
```sql
UPDATE todos SET deadline = ? WHERE id = ?
```

- Empty deadline input → `null` (clears the deadline)
- `is_important` saved as `1` or `0`

---

## Section 2: Rendering (`TodoPanel.renderItem`)

Every **open** todo gets a `div.todo-chips` row below the text, containing two chips rendered unconditionally. Each chip carries a `data-chip` attribute (`"importance"` or `"deadline"`) to distinguish click handlers.

**Deadline chip** (`data-chip="deadline"`):
- `todo.deadline === null` → ghost chip: `+ due date` (dashed border, dim colour)
- `todo.deadline !== null` → filled chip: `due <value>`
- Click → opens `startMetaEdit` inline form

**Importance chip** (`data-chip="importance"`):
- `todo.is_important === 0` → ghost chip: `☆ important`
- `todo.is_important === 1` → filled chip with accent styling: `★ important`
- Click → **directly** saves the toggled value to DB and reloads (no form)

The existing read-only section badges (`important`, `overdue`) in `metaHtml` are unchanged.

**Completed todos:** no chips, no edit row — unchanged from current behaviour.

---

## Section 3: `startMetaEdit` Interaction

```ts
private startMetaEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void
```

**Purpose:** deadline editing only. Importance is handled by the chip directly.

**Guard:** if `el.querySelector('div.todo-meta-edit')` exists, return (idempotent).

**Mutual exclusion:** if a text edit (`textarea.todo-edit-area`) is open on this element, restore `textEl.innerHTML` to its original HTML before proceeding.

**Edit row structure (`div.todo-meta-edit`):**
- Appended to `div.todo-content` (the `flex:1` inner column) so it renders below the chips
- Contains:
  - Text input, `placeholder="due date (e.g. Jun 15)"`, pre-filled with `todo.deadline ?? ''`
  - **Save** button
  - **Cancel** button (or Escape key)

**Save behaviour:**
- Runs `UPDATE todos SET deadline = ? WHERE id = ?`
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
| Filled importance chip rendered | `★ important` with `filled` and `important` classes when `is_important: 1` |
| Importance chip direct toggle | Click `[data-chip="importance"]` → `execute` called with `UPDATE todos SET is_important = ?`, meta-edit NOT opened |
| `startMetaEdit` opens edit row | Click deadline chip → `div.todo-meta-edit` appears with input, no importance button |
| Edit row pre-fills existing deadline | Click chip on todo with deadline → input pre-filled with deadline value |
| Save updates deadline | Simulate save → `execute` called with `UPDATE todos SET deadline = ? WHERE id = ?` |
| Clearing deadline saves null | Save with empty input → `execute` called with `null` for deadline |
| Mutual exclusion (text → meta) | Open text edit, click chip → text edit closed, meta edit open |
| Escape closes without saving | Open meta edit, press Escape → row removed, `execute` not called |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/TodoPanel.ts` | Add `div.todo-chips` to `renderItem`; add `startMetaEdit` method (deadline only); importance chip wired as direct toggle |
| `src/styles.css` | Add styles for `.todo-chips`, `.todo-chip` ghost/filled/important states, `.todo-meta-edit`; add `.todo-content { flex: 1; min-width: 0 }` |
| `src/__tests__/components/TodoPanel.test.ts` | 11 new tests covering chips, direct importance toggle, deadline form, and mutual exclusion |
