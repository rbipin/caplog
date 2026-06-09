# Todo Meta Edit (Deadline & Importance) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit a todo's deadline and importance after creation by clicking always-visible chips on each open todo.

**Architecture:** Add a `div.todo-chips` row to `renderItem` for open todos only; clicking either chip calls `startMetaEdit` which inserts a `div.todo-meta-edit` edit row below the todo item. Save runs a single `UPDATE todos SET deadline = ?, is_important = ? WHERE id = ?`. Text editing (`startTodoEdit`) and meta editing (`startMetaEdit`) are mutually exclusive — opening one closes the other. No DB schema changes.

**Tech Stack:** TypeScript, Vitest + happy-dom, SQLite via Tauri IPC, vanilla DOM.

---

## File Map

| File | Change |
|------|--------|
| `src/components/TodoPanel.ts` | Add `div.todo-chips` to `renderItem`; add `startMetaEdit` method |
| `src/styles.css` | Add `.todo-chips`, `.todo-chip`, `.todo-chip.ghost`, `.todo-meta-edit` styles |
| `src/__tests__/components/TodoPanel.test.ts` | Add 10 new tests (all cases from spec §4) |

---

## Task 1: Add chip styles to `src/styles.css`

**Files:**
- Modify: `src/styles.css`

CSS is defined first so chips render correctly the moment the JS lands them in the DOM.

- [ ] **Step 1: Add chip and meta-edit styles**

After the `.todo-badge.overdue` rule (around line 710), insert:

```css
.todo-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.todo-chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: 0.03em;
  user-select: none;
  transition: opacity 0.1s;
}

.todo-chip.ghost {
  border: 1px dashed var(--border-hover);
  color: var(--text-dim);
  background: transparent;
}

.todo-chip.ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.todo-chip.filled {
  border: 1px solid var(--border-hover);
  color: var(--text-muted);
  background: var(--surface);
}

.todo-chip.filled:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.todo-meta-edit {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.todo-meta-edit input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 3px 8px;
  border-radius: 3px;
  font-family: inherit;
  font-size: 13px;
  width: 140px;
}

.todo-meta-edit input:focus {
  outline: none;
  border-color: var(--accent);
}

.todo-meta-importance-btn,
.todo-meta-save,
.todo-meta-cancel {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: inherit;
}

.todo-meta-importance-btn:hover,
.todo-meta-save:hover { color: var(--accent); border-color: var(--accent); }
.todo-meta-cancel:hover { color: var(--text); border-color: var(--border-hover); }

.todo-meta-importance-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-dim);
}
```

- [ ] **Step 2: Verify build passes**

```bash
pnpm build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: add todo chip and meta-edit row styles"
```

---

## Task 2: Add chips to `renderItem` and `startMetaEdit` to `TodoPanel`

**Files:**
- Modify: `src/components/TodoPanel.ts`
- Test: `src/__tests__/components/TodoPanel.test.ts`

### Step 1 — Write failing tests

- [ ] **Step 1: Add the 10 new tests to `src/__tests__/components/TodoPanel.test.ts`**

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
  expect(deadlineChip!.classList.contains('ghost')).toBe(false);
});

it('startMetaEdit: clicking a chip opens div.todo-meta-edit with input and toggle', async () => {
  const todo = makeTodo({ id: 23, text: 'Open meta edit' });
  await triggerReload([todo]);

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  expect(chip).not.toBeNull();
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  const editRow = document.querySelector('.todo-meta-edit');
  expect(editRow).not.toBeNull();
  expect(editRow!.querySelector('input')).not.toBeNull();
  expect(editRow!.querySelector('.todo-meta-importance-btn')).not.toBeNull();
});

it('edit row pre-fills existing deadline in the input', async () => {
  const todo = makeTodo({ id: 24, text: 'Prefilled', deadline: '2026-08-15' });
  await triggerReload([todo]);

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  expect(input.value).toBe('2026-08-15');
});

it('Save calls UPDATE todos SET deadline and is_important with correct values', async () => {
  const todo = makeTodo({ id: 25, text: 'To update', deadline: null, is_important: 0 });
  await triggerReload([todo]);

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  input.value = '2026-09-01';

  vi.clearAllMocks();
  setTodosQuery([]);
  const saveBtn = document.querySelector('.todo-meta-save') as HTMLButtonElement;
  saveBtn.click();
  await new Promise(r => setTimeout(r, 30));

  expect(executeMock).toHaveBeenCalledWith(
    'UPDATE todos SET deadline = ?, is_important = ? WHERE id = ?',
    ['2026-09-01', 0, 25]
  );
});

it('Save with empty deadline input passes null to execute', async () => {
  const todo = makeTodo({ id: 26, text: 'Clear deadline', deadline: '2026-07-01' });
  await triggerReload([todo]);

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  input.value = '';

  vi.clearAllMocks();
  setTodosQuery([]);
  const saveBtn = document.querySelector('.todo-meta-save') as HTMLButtonElement;
  saveBtn.click();
  await new Promise(r => setTimeout(r, 30));

  expect(executeMock).toHaveBeenCalledWith(
    'UPDATE todos SET deadline = ?, is_important = ? WHERE id = ?',
    [null, 0, 26]
  );
});

it('importance toggle flips displayed state (☆ ↔ ★) without writing to DB', async () => {
  const todo = makeTodo({ id: 27, text: 'Toggle important', is_important: 0 });
  await triggerReload([todo]);

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  const toggleBtn = document.querySelector('.todo-meta-importance-btn') as HTMLButtonElement;
  expect(toggleBtn.textContent?.trim()).toContain('☆');

  vi.clearAllMocks();
  toggleBtn.click();
  await new Promise(r => setTimeout(r, 10));

  expect(toggleBtn.textContent?.trim()).toContain('★');
  expect(executeMock).not.toHaveBeenCalled();
});

it('mutual exclusion: opening text edit then clicking chip closes text edit and opens meta edit', async () => {
  const todo = makeTodo({ id: 28, text: 'Mutual exclusion' });
  await triggerReload([todo]);

  const textEl = document.querySelector('.todo-item:not(.completed) .todo-text') as HTMLElement;
  textEl.click();
  await new Promise(r => setTimeout(r, 10));
  expect(document.querySelector('.todo-edit-area')).not.toBeNull();

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  expect(document.querySelector('.todo-edit-area')).toBeNull();
  expect(document.querySelector('.todo-meta-edit')).not.toBeNull();
});

it('Escape key closes meta edit without calling execute', async () => {
  const todo = makeTodo({ id: 29, text: 'Escape test' });
  await triggerReload([todo]);

  const chip = document.querySelector('.todo-item:not(.completed) .todo-chip') as HTMLElement;
  chip.click();
  await new Promise(r => setTimeout(r, 10));

  vi.clearAllMocks();
  const input = document.querySelector('.todo-meta-edit input') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  expect(document.querySelector('.todo-meta-edit')).toBeNull();
  expect(executeMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --run
```

Expected: the 10 new tests FAIL (`.todo-chip` elements not found), all pre-existing tests still PASS.

### Step 3 — Implement chips in `renderItem`

- [ ] **Step 3: Add `div.todo-chips` to `renderItem` in `src/components/TodoPanel.ts`**

Replace the `metaHtml` block and `el.innerHTML` assignment in `renderItem` (lines ~134–154) with:

```ts
const metaHtml = (() => {
  const parts: string[] = [];
  if (todo.deadline) {
    parts.push(`<span class="todo-deadline${status === 'overdue' ? ' overdue' : ''}">${escapeHtml(todo.deadline)}</span>`);
  }
  if (status === 'important') {
    parts.push('<span class="todo-badge important">important</span>');
  } else if (status === 'overdue') {
    parts.push('<span class="todo-badge overdue">overdue</span>');
  }
  return parts.length ? `<div class="todo-meta">${parts.join('')}</div>` : '';
})();

const chipsHtml = status !== 'completed' ? (() => {
  const deadlineChip = todo.deadline
    ? `<span class="todo-chip filled">due ${escapeHtml(todo.deadline)}</span>`
    : `<span class="todo-chip ghost">+ due date</span>`;
  const importanceChip = todo.is_important
    ? `<span class="todo-chip filled">★ important</span>`
    : `<span class="todo-chip ghost">☆ important</span>`;
  return `<div class="todo-chips">${deadlineChip}${importanceChip}</div>`;
})() : '';

el.innerHTML = `
  <div class="todo-check">${checkInner}</div>
  <div style="flex:1">
    <div class="todo-text">${escapeHtml(todo.text)}</div>
    ${metaHtml}
    ${chipsHtml}
  </div>
  <button class="todo-delete-btn" title="Delete">✕</button>
`;
```

After the existing `el.addEventListener('click', ...)` block for open todos (which guards against `.todo-delete-btn` and `.todo-text`), update the guard to also skip chip clicks, then wire chips to `startMetaEdit`:

```ts
if (status !== 'completed') {
  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.todo-delete-btn')) return;
    if ((e.target as HTMLElement).closest('.todo-text')) return;
    if ((e.target as HTMLElement).closest('.todo-chips')) return;
    this.complete(todo.id);
  });

  const textEl = el.querySelector('.todo-text') as HTMLElement;
  textEl.style.cursor = 'text';
  textEl.addEventListener('click', (e) => {
    e.stopPropagation();
    this.startTodoEdit(el, textEl, todo);
  });

  el.querySelectorAll<HTMLElement>('.todo-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startMetaEdit(el, textEl, todo);
    });
  });
}
```

- [ ] **Step 4: Run the chip-render tests to verify they pass**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --run -t "ghost chips|filled deadline|absent on completed"
```

Expected: those 3 tests PASS; the `startMetaEdit` tests still FAIL.

### Step 4 — Implement `startMetaEdit`

- [ ] **Step 5: Add `startMetaEdit` method to `TodoPanel`**

Add this method after `startTodoEdit` (before `async delete`):

```ts
private startMetaEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void {
  if (el.querySelector('div.todo-meta-edit')) return;

  // Close any open text edit on this item
  const existingTextEdit = el.querySelector('textarea.todo-edit-area');
  if (existingTextEdit) {
    // Restore original text by re-rendering just the text element
    textEl.innerHTML = escapeHtml(todo.text);
  }

  let importantState = todo.is_important === 1;

  const editRow = document.createElement('div');
  editRow.className = 'todo-meta-edit';

  const deadlineInput = document.createElement('input');
  deadlineInput.type = 'text';
  deadlineInput.placeholder = 'due date (e.g. Jun 15)';
  deadlineInput.value = todo.deadline ?? '';

  const importanceBtn = document.createElement('button');
  importanceBtn.className = `todo-meta-importance-btn${importantState ? ' active' : ''}`;
  importanceBtn.textContent = importantState ? '★ Important' : '☆ Important';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'todo-meta-save';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'todo-meta-cancel';
  cancelBtn.textContent = 'Cancel';

  editRow.appendChild(deadlineInput);
  editRow.appendChild(importanceBtn);
  editRow.appendChild(saveBtn);
  editRow.appendChild(cancelBtn);
  el.appendChild(editRow);

  deadlineInput.focus();

  const close = () => { editRow.remove(); };

  importanceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    importantState = !importantState;
    importanceBtn.textContent = importantState ? '★ Important' : '☆ Important';
    importanceBtn.classList.toggle('active', importantState);
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  saveBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const deadline = deadlineInput.value.trim() || null;
    await execute(
      'UPDATE todos SET deadline = ?, is_important = ? WHERE id = ?',
      [deadline, importantState ? 1 : 0, todo.id]
    );
    await this.load();
  });

  deadlineInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') saveBtn.click();
  });
}
```

- [ ] **Step 6: Run all TodoPanel tests**

```bash
pnpm test src/__tests__/components/TodoPanel.test.ts --run
```

Expected: all 10 new tests PASS, all pre-existing tests still PASS.

- [ ] **Step 7: Run the full test suite**

```bash
pnpm test --run
```

Expected: all tests green.

- [ ] **Step 8: Commit**

```bash
git add src/components/TodoPanel.ts src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: add deadline/importance chips and inline meta-edit to todos"
```

---

## Verification Checklist

- [ ] `pnpm test --run` — all tests green
- [ ] `pnpm build` — type-check passes
- [ ] Manual smoke test: open todo with no deadline → ghost `+ due date` chip visible
- [ ] Manual smoke test: click chip → edit row opens with empty input and `☆ Important` toggle
- [ ] Manual smoke test: enter a deadline, click Save → chip updates to `due <value>`
- [ ] Manual smoke test: click chip again, toggle importance, Save → badge appears in section header area
- [ ] Manual smoke test: open text edit, click chip → text edit gone, meta edit opens
- [ ] Manual smoke test: open meta edit, press Escape → row disappears, nothing saved
- [ ] Manual smoke test: completed todos have no chips
