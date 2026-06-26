import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogModal } from '../../components/LogModal.js';
import type { TodoItem } from '../../types.js';

vi.mock('../../export.js', () => ({ exportMarkdown: vi.fn() }));

function todo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 1,
    text: 'a todo',
    is_important: 0,
    is_completed: 1,
    deadline: null,
    created_at: '2026-06-24T09:00:00.000',
    completed_at: '2026-06-25T14:00:00.000',
    ...overrides,
  };
}

describe('LogModal.open — completed todos', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="logModal">
        <div id="modalSubtitle"></div>
        <div id="modalBody"></div>
        <button id="modalCloseBtn"></button>
        <button id="modalFooterCloseBtn"></button>
        <button id="modalExportBtn"></button>
      </div>`;
  });

  it('renders a "Completed Todos" sub-section with the completed todo text', () => {
    const modal = new LogModal();
    modal.open([
      {
        date: 'Thursday, Jun 25',
        items: [{ text: 'Shipped the build', time: '10:00' }],
        completedTodos: [todo({ id: 1, text: 'Ship release' }), todo({ id: 2, text: 'Review PR' })],
      },
    ]);

    const body = document.getElementById('modalBody')!;
    expect(body.querySelector('.log-view-subhead')!.textContent).toContain('Completed Todos');
    const todoItems = body.querySelectorAll('.log-view-todo');
    expect(todoItems.length).toBe(2);
    expect(todoItems[0].textContent).toContain('Ship release');
    expect(todoItems[1].textContent).toContain('Review PR');
    expect(document.getElementById('logModal')!.classList.contains('visible')).toBe(true);
  });

  it('renders a day that has only completed todos and no log entries', () => {
    const modal = new LogModal();
    modal.open([
      { date: 'Saturday, Jun 20', items: [], completedTodos: [todo({ text: 'Solo todo' })] },
    ]);

    const body = document.getElementById('modalBody')!;
    expect(body.querySelectorAll('.log-view-item:not(.log-view-todo)').length).toBe(0);
    expect(body.querySelector('.log-view-todo')!.textContent).toContain('Solo todo');
  });

  it('omits the completed-todos sub-section when there are none', () => {
    const modal = new LogModal();
    modal.open([
      { date: 'Friday, Jun 26', items: [{ text: 'Just a log', time: '09:00' }], completedTodos: [] },
    ]);

    const body = document.getElementById('modalBody')!;
    expect(body.querySelector('.log-view-subhead')).toBeNull();
    expect(body.querySelector('.log-view-todo')).toBeNull();
  });

  it('escapes HTML in completed todo text', () => {
    const modal = new LogModal();
    modal.open([
      { date: 'Friday, Jun 26', items: [], completedTodos: [todo({ text: '<img src=x onerror=alert(1)>' })] },
    ]);

    const body = document.getElementById('modalBody')!;
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('.log-view-todo')!.textContent).toContain('<img');
  });
});
