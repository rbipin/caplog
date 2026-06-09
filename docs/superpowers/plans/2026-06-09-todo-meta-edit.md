# Todo Meta Edit (Deadline & Importance) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit a todo's deadline and importance after creation via always-visible chips on each open todo.

**Architecture:** Add a `div.todo-chips` row to `renderItem` for open todos only. The importance chip is a **direct toggle** — clicking it saves `is_important` immediately with no form. The deadline chip opens a `div.todo-meta-edit` inline form appended to `div.todo-content` (the `flex:1` inner column). Text editing (`startTodoEdit`) and deadline meta-editing (`startMetaEdit`) are mutually exclusive. No DB schema changes.

**Tech Stack:** TypeScript, Vitest + happy-dom, SQLite via Tauri IPC, vanilla DOM.

---

## File Map

| File | Change |
|------|--------|
| `src/components/TodoPanel.ts` | Add `div.todo-chips` to `renderItem`; wire importance chip as direct toggle; add `startMetaEdit` for deadline only |
| `src/styles.css` | Add `.todo-content`, `.todo-chips`, `.todo-chip` (ghost/filled/important), `.todo-meta-edit` styles |
| `src/__tests__/components/TodoPanel.test.ts` | Add 11 new tests |

---

## Task 1: Add chip and layout styles to `src/styles.css`

**Files:**
- Modify: `src/styles.css`

CSS is defined first so chips render correctly the moment the JS lands them in the DOM.

- [x] **Step 1: Add `.todo-content` and chip styles**

Replace the inline `style="flex:1"` on the todo item's inner div with a `.todo-content` class, and add all chip/meta-edit styles after the `.todo-badge.overdue` rule:

```css
.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-chips { display: flex; align-items: center; gap: 6px; margin-top: 4px; }

.todo-chip {
  font-size: 10px; padding: 1px 6px; border-radius: 2px; cursor: pointer;
  letter-spacing: 0.03em; user-select: none;
  transition: color 0.1s, border-color 0.1s;
}

.todo-chip.ghost { border: 1px dashed var(--border-hover); color: var(--text-dim); background: transparent; }
.todo-chip.ghost:hover { border-color: var(--accent); color: var(--accent); }
.todo-chip.filled { border: 1px solid var(--border-hover); color: var(--text-muted); background: var(--surface); }
.todo-chip.filled:hover { border-color: var(--accent); color: var(--accent); }
.todo-chip.important { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }

.todo-meta-edit {
  display: flex; align-items: center; gap: 8px; margin-top: 6px;
  padding: 6px 8px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 4px;
}
.todo-meta-edit input {
  background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 3px 8px; border-radius: 3px; font-family: inherit; font-size: 13px; width: 140px;
}
.todo-meta-edit input:focus { outline: none; border-color: var(--accent); }
.todo-meta-edit input::placeholder { color: var(--text-dim); }
.todo-meta-save,
.todo-meta-cancel {
  font-size: 12px; padding: 2px 8px; border-radius: 3px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; font-family: inherit;
}
.todo-meta-save:hover { color: var(--accent); border-color: var(--accent); }
.todo-meta-cancel:hover { color: var(--text); border-color: var(--border-hover); }
```

- [x] **Step 2: Verify build passes**

```bash
pnpm build
```

Expected: exits 0.

- [x] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: add todo chip and meta-edit row styles"
```

---

## Task 2: Add chips to `renderItem`, importance toggle, and `startMetaEdit`

**Files:**
- Modify: `src/components/TodoPanel.ts`
- Test: `src/__tests__/components/TodoPanel.test.ts`

### Step 1 — Write failing tests

- [x] **Step 1: Add 11 new tests to `src/__tests__/components/TodoPanel.test.ts`**

Append inside the `describe('TodoPanel')` block, after the existing tests:

```ts
// --- Meta edit (chips) tests ---

it('ghost chips render on open todo with no deadline and is_important=0', async () => {
  const todo = makeTodo({ id: 20, text: 'Chip test', deadline: null, is_important: 0 });
  await triggerReload([todo]);
  const chips = document.querySelectorAll('.todo-item:not(.completed) .todo-chip');
  const texts = Array.from(chips).map(c => c.textContent?.trim());
  expect(texts).toContain('+ due date');
  expect(texts).toContain('☆ important');
});

it('ghost chips are absent on completed todos', async () => {
  const todo = makeTodo({ id: 21, text: 'Done', is_completed: 1,
                          completed_at: new Date().toISOString() });
  await triggerReload([todo]);
  const chips = document.querySelectorAll('.todo-item.completed .todo-chip');
  expect(chips.length).toBe(0);
});

it('filled deadline chip shows "due <value>" when todo has a deadline', async () => {
  const todo = makeTodo({ id: 22, text: 'Has deadline', deadline: '2026-07-01' });
  await triggerReload([todo]);
  const chips = Array.from(document.querySelectorAll('.todo-item:not(.completed) .todo-chip'));
  const deadlineChip = chips.find(c => c.textContent?.includes('due'));
  expect(deadlineChip).not.toBeNull();
  expect(deadlineChip!.textContent?.trim()).toBe('due 2026-07-01');
  expect(deadlineChip!.classList.contains('filled')).toBe(true);
});

it('filled importance chip renders "★ important" with filled class when is_important=1', async () => {
  const todo = makeTodo({ id: 32, text: 'Is important', is_important: 1 });
  await triggerReload([todo]);
  const chips = Array.from(document.querySelectorAll('.todo-item:not(.completed) .todo-chip'));
  const importanceChip = chips.find(c => c.textContent?.includes('important'));
  expect(importanceChip).not.toBeNull();
  expect(importanceChip!.textContent?.trim()).toBe('★ important');
  expect(importanceChip!.classList.contains('filled')).toBe(true);
});

it('importance chip directly toggles is_important without opening meta-edit', async () => {
  const todo = makeTodo({ id: 34, text: 'Direct toggle', is_important: 0 });
  await triggerReload([todo]);
  const importanceChip = document.querySelector<HTMLElement>('[data-chip="importance"]');
  expect(importanceChip).not.toBeNull();
  vi.clearAllMocks();
  setTodosQuery([]);
  importanceChip!.click();
  await new Promise(r => setTimeout(r, 30));
  expect(executeMock).toHaveBeenCalledWith(
    'UPDATE todos SET is_important = ? WHERE id = ?',
    [1, 34]
  );
  expect(document.querySelector('.todo-meta-edit')).toBeNull();
});

it('deadline chip opens div.todo-meta-edit with input (no importance button)', async () => {
  const todo = makeTodo({ id: 23, text: 'Open meta edit' });
  await triggerReload([todo]);
  const chip = document.querySelector('[data-chip="deadline"]') as HTMLElement;
  expect(chip).not.toBeNull();
  chip.click();
  await new Promise(r => setTimeout(r, 10));
  const editRow = document.querySelector('.todo-meta-edit');
  expect(editRow).not.toBeNull();
  expect(editRow!.querySelector('input')).not.toBeNull();
  expect(editRow!.querySelector('.todo-meta-importance-btn')).toBeNull();
});

it('edit row pre-fills existing deadline in the input', async () => {
  const todo = makeTodo({ id: 24, text: 'Prefilled', deadline: '2026-08-15' });
  await triggerReload([todo]);
  const chip = document.querySelector('[data-chip="deadline"]') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));
  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  expect(input.value).toBe('2026-08-15');
});

it('Save updates deadline via UPDATE todos SET deadline', async () => {
  const todo = makeTodo({ id: 25, text: 'To update', deadline: null });
  await triggerReload([todo]);
  const chip = document.querySelector('[data-chip="deadline"]') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));
  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  input.value = '2026-09-01';
  vi.clearAllMocks();
  setTodosQuery([]);
  (document.querySelector('.todo-meta-save') as HTMLButtonElement).click();
  await new Promise(r => setTimeout(r, 30));
  expect(executeMock).toHaveBeenCalledWith(
    'UPDATE todos SET deadline = ? WHERE id = ?',
    ['2026-09-01', 25]
  );
});

it('Save with empty deadline input passes null to execute', async () => {
  const todo = makeTodo({ id: 26, text: 'Clear deadline', deadline: '2026-07-01' });
  await triggerReload([todo]);
  const chip = document.querySelector('[data-chip="deadline"]') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));
  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  input.value = '';
  vi.clearAllMocks();
  setTodosQuery([]);
  (document.querySelector('.todo-meta-save') as HTMLButtonElement).click();
  await new Promise(r => setTimeout(r, 30));
  expect(executeMock).toHaveBeenCalledWith(
    'UPDATE todos SET deadline = ? WHERE id = ?',
    [null, 26]
  );
});

it('mutual exclusion: opening text edit then clicking deadline chip closes text edit and opens meta edit', async () => {
  const todo = makeTodo({ id: 28, text: 'Mutual exclusion' });
  await triggerReload([todo]);
  (document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement).click();
  await new Promise(r => setTimeout(r, 10));
  expect(document.querySelector('.todo-edit-area')).not.toBeNull();
  (document.querySelector('[data-chip="deadline"]') as HTMLElement).click();
  await new Promise(r => setTimeout(r, 10));
  expect(document.querySelector('.todo-edit-area')).toBeNull();
  expect(document.querySelector('.todo-meta-edit')).not.toBeNull();
});

it('Escape key closes meta edit without calling execute', async () => {
  const todo = makeTodo({ id: 29, text: 'Escape test' });
  await triggerReload([todo]);
  (document.querySelector('[data-chip="deadline"]') as HTMLElement).click();
  await new Promise(r => setTimeout(r, 10));
  vi.clearAllMocks();
  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 10));
  expect(document.querySelector('.todo-meta-edit')).toBeNull();
  expect(executeMock).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run tests to verify the new tests fail**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --run
```

Expected: new tests FAIL (`.todo-chip` not found), pre-existing tests pass.

### Step 3 — Implement chips in `renderItem`

- [x] **Step 3: Add `div.todo-chips` and wire chip click handlers in `renderItem`**

In `renderItem`, replace the inner `div[style="flex:1"]` with `div.todo-content`, add `chipsHtml`, update the click guard, and wire each chip separately:

```ts
const chipsHtml = status !== 'completed' ? (() => {
  const deadlineChip = todo.deadline
    ? `<span class="todo-chip filled" data-chip="deadline">due ${escapeHtml(todo.deadline)}</span>`
    : `<span class="todo-chip ghost" data-chip="deadline">+ due date</span>`;
  const importanceChip = todo.is_important
    ? `<span class="todo-chip filled important" data-chip="importance">★ important</span>`
    : `<span class="todo-chip ghost" data-chip="importance">☆ important</span>`;
  return `<div class="todo-chips">${deadlineChip}${importanceChip}</div>`;
})() : '';

el.innerHTML = `
  <div class="todo-check">${checkInner}</div>
  <div class="todo-content">
    <div class="todo-text">${escapeHtml(todo.text)}</div>
    ${metaHtml}
    ${chipsHtml}
  </div>
  <button class="todo-delete-btn" title="Delete">✕</button>
`;
```

Click handler wiring (inside the `if (status !== 'completed')` block):

```ts
el.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('.todo-delete-btn')) return;
  if ((e.target as HTMLElement).closest('.todo-text')) return;
  if ((e.target as HTMLElement).closest('.todo-chips')) return;
  this.complete(todo.id);
});

// deadline chip → open inline form
el.querySelector<HTMLElement>('[data-chip="deadline"]')?.addEventListener('click', (e) => {
  e.stopPropagation();
  this.startMetaEdit(el, textEl, todo);
});

// importance chip → direct toggle
el.querySelector<HTMLElement>('[data-chip="importance"]')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  await execute(
    'UPDATE todos SET is_important = ? WHERE id = ?',
    [todo.is_important ? 0 : 1, todo.id]
  );
  await this.load();
});
```

### Step 4 — Implement `startMetaEdit` (deadline only)

- [x] **Step 4: Add `startMetaEdit` after `startTodoEdit`**

Also add the reverse mutual exclusion guard at the top of `startTodoEdit`:

```ts
private startTodoEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void {
  el.querySelector('div.todo-meta-edit')?.remove();  // close meta-edit if open
  if (el.querySelector('textarea.todo-edit-area')) return;
  // ... rest unchanged
}

private startMetaEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void {
  if (el.querySelector('div.todo-meta-edit')) return;

  if (el.querySelector('textarea.todo-edit-area')) {
    textEl.innerHTML = escapeHtml(todo.text);  // close text edit
  }

  const editRow = document.createElement('div');
  editRow.className = 'todo-meta-edit';

  const deadlineInput = document.createElement('input');
  deadlineInput.type = 'text';
  deadlineInput.placeholder = 'due date (e.g. Jun 15)';
  deadlineInput.value = todo.deadline ?? '';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'todo-meta-save';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'todo-meta-cancel';
  cancelBtn.textContent = 'Cancel';

  editRow.appendChild(deadlineInput);
  editRow.appendChild(saveBtn);
  editRow.appendChild(cancelBtn);

  // Append to .todo-content column, not to el (flex row), so it renders below the chips
  const contentEl = el.querySelector<HTMLElement>('.todo-content') ?? el;
  contentEl.appendChild(editRow);
  editRow.addEventListener('click', (e) => e.stopPropagation());  // prevent accidental completion

  deadlineInput.focus();

  const close = () => { editRow.remove(); };

  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  saveBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    saveBtn.disabled = true;
    saveBtn.textContent = '...';
    const deadline = deadlineInput.value.trim() || null;
    await execute('UPDATE todos SET deadline = ? WHERE id = ?', [deadline, todo.id]);
    await this.load();
  });

  deadlineInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') saveBtn.click();
  });
}
```

- [x] **Step 5: Run all TodoPanel tests**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --run
```

Expected: all 11 new tests PASS, all pre-existing tests pass.

- [x] **Step 6: Run the full test suite**

```bash
pnpm test --run
```

Expected: all tests green.

- [x] **Step 7: Commit**

```bash
git add src/components/TodoPanel.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: add deadline/importance chips and inline meta-edit to todos"
```

---

## Verification Checklist

- [x] `pnpm test --run` — 139 tests passing
- [x] `pnpm build` — type-check passes
- [x] Importance chip click → todo moves to Important section immediately (no form)
- [x] Deadline chip click → inline form opens below chips, inside the content column
- [x] Enter a deadline, click Save → chip updates to `due <value>`
- [x] Open text edit, click deadline chip → text edit gone, meta edit opens
- [x] Open meta edit, click text → meta edit gone, text edit opens
- [x] Open meta edit, press Escape → row disappears, nothing saved
- [x] Clicking inside deadline input does not complete the todo
- [x] Completed todos have no chips
