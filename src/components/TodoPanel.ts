import { query, execute } from '../db.js';
import { escapeHtml, getToday } from '../utils.js';
import { todoStatus, getTodoSections } from '../todoLogic.js';
import type { TodoItem } from '../types.js';

export class TodoPanel {
  private listEl: HTMLElement;
  private countEl: HTMLElement;
  private onComplete: (() => void) | null = null;
  private cutoffDays: number | undefined;

  constructor() {
    this.listEl = document.getElementById('todoList')!;
    this.countEl = document.getElementById('todoCount')!;
  }

  setOnComplete(cb: () => void): void {
    this.onComplete = cb;
  }

  async load(days?: number): Promise<void> {
    if (days !== undefined) this.cutoffDays = days;

    let todos: TodoItem[];
    if (this.cutoffDays !== undefined) {
      const today = getToday();
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

  async add(text: string, isImportant = false, deadline: string | null = null): Promise<void> {
    await execute(
      'INSERT INTO todos (text, is_important, deadline, created_at) VALUES (?, ?, ?, ?)',
      [text, isImportant ? 1 : 0, deadline, new Date().toISOString()]
    );
    await this.load();
  }

  async complete(id: number): Promise<void> {
    await execute(
      'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    await this.load();
    this.onComplete?.();
  }

  async completeByText(text: string): Promise<boolean> {
    const escaped = text.replace(/[%_\\]/g, '\\$&');
    const rows = await query<TodoItem>(
      "SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?) ESCAPE '\\'",
      [`%${escaped}%`]
    );
    if (rows.length === 0) return false;
    await this.complete(rows[0].id);
    return true;
  }

  async reopen(id: number): Promise<void> {
    await execute('UPDATE todos SET is_completed = 0, completed_at = NULL WHERE id = ?', [id]);
    await this.load();
    this.onComplete?.();
  }

  private startTodoEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void {
    el.querySelector('div.todo-meta-edit')?.remove();
    if (el.querySelector('textarea.todo-edit-area')) return;

    const originalHtml = textEl.innerHTML;
    textEl.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'todo-edit-area';
    textarea.value = todo.text;
    textEl.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'todo-edit-actions';
    actions.innerHTML = '<button class="todo-edit-save">Save</button><button class="todo-edit-cancel">Cancel</button>';
    textEl.appendChild(actions);

    textarea.focus();

    const cancel = () => { textEl.innerHTML = originalHtml; };

    actions.querySelector('.todo-edit-cancel')!.addEventListener('click', (e) => {
      e.stopPropagation();
      cancel();
    });

    actions.querySelector('.todo-edit-save')!.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newText = textarea.value.trim();
      if (!newText) return;
      const saveBtn = e.currentTarget as HTMLButtonElement;
      saveBtn.textContent = '...';
      saveBtn.disabled = true;
      await execute('UPDATE todos SET text = ? WHERE id = ?', [newText, todo.id]);
      await this.load();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (actions.querySelector('.todo-edit-save') as HTMLButtonElement).click();
      }
      if (e.key === 'Escape') cancel();
    });
  }

  private startMetaEdit(el: HTMLElement, textEl: HTMLElement, todo: TodoItem): void {
    if (el.querySelector('div.todo-meta-edit')) return;

    // Close any open text edit on this item
    if (el.querySelector('textarea.todo-edit-area')) {
      textEl.innerHTML = escapeHtml(todo.text);
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
    const contentEl = el.querySelector<HTMLElement>('.todo-content') ?? el;
    contentEl.appendChild(editRow);
    editRow.addEventListener('click', (e) => e.stopPropagation());

    deadlineInput.focus();

    const close = () => { editRow.remove(); };

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });

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

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM todos WHERE id = ?', [id]);
    await this.load();
  }

  private renderItem(todo: TodoItem): HTMLElement {
    const status = todoStatus(todo);
    const el = document.createElement('div');
    el.className = `todo-item${status !== 'open' ? ` ${status}` : ''}`;
    el.dataset.id = String(todo.id);

    const checkInner = status === 'completed' ? '<span class="completed-check">✓</span>' : '';

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

      el.querySelector<HTMLElement>('[data-chip="deadline"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startMetaEdit(el, textEl, todo);
      });

      el.querySelector<HTMLElement>('[data-chip="importance"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await execute(
          'UPDATE todos SET is_important = ? WHERE id = ?',
          [todo.is_important ? 0 : 1, todo.id]
        );
        await this.load();
      });
    } else {
      const checkEl = el.querySelector<HTMLElement>('.todo-check');
      if (checkEl) {
        checkEl.style.cursor = 'pointer';
        checkEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.reopen(todo.id).catch((err) => console.error('reopen failed', err));
        });
      }
    }

    el.querySelector('.todo-delete-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.delete(todo.id);
    });

    return el;
  }

  private render(todos: TodoItem[]): void {
    const archiveWasOpen = (this.listEl.querySelector('details.todo-archive') as HTMLDetailsElement | null)?.open ?? false;
    this.listEl.innerHTML = '';

    const sections = getTodoSections();

    for (const section of sections) {
      const items = todos.filter(section.filter);
      if (items.length === 0) continue;

      if (section.collapsed) {
        const details = document.createElement('details');
        details.className = 'todo-archive';
        if (archiveWasOpen) details.open = true;
        const summary = document.createElement('summary');
        summary.className = 'todo-section-label todo-archive-summary';
        summary.textContent = `${section.label} (${items.length})`;
        details.appendChild(summary);
        for (const item of items) details.appendChild(this.renderItem(item));
        this.listEl.appendChild(details);
      } else {
        const label = document.createElement('div');
        label.className = 'todo-section-label';
        label.textContent = section.label;
        this.listEl.appendChild(label);
        for (const item of items) this.listEl.appendChild(this.renderItem(item));
      }
    }

    const open = todos.filter((t) => !t.is_completed).length;
    const done = todos.filter((t) => t.is_completed).length;
    this.countEl.textContent = `${open} open · ${done} done`;
  }
}
