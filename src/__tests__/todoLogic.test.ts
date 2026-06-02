import { describe, it, expect } from 'vitest';
import { todoStatus, getTodoSections } from '../todoLogic.js';
import type { TodoItem } from '../types.js';

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 1,
    text: 'test',
    is_important: 0,
    is_completed: 0,
    deadline: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

describe('todoStatus', () => {
  it('completed todo → completed', () => {
    expect(todoStatus(makeTodo({ is_completed: 1 }))).toBe('completed');
  });
  it('important + incomplete → important', () => {
    expect(todoStatus(makeTodo({ is_important: 1 }))).toBe('important');
  });
  it('past deadline + incomplete → overdue', () => {
    expect(todoStatus(makeTodo({ deadline: '2000-01-01' }))).toBe('overdue');
  });
  it('no deadline, not important, not completed → open', () => {
    expect(todoStatus(makeTodo())).toBe('open');
  });
});

describe('getTodoSections', () => {
  it('important section excludes completed items', () => {
    const sections = getTodoSections();
    const important = sections.find(s => s.label === 'Important')!;
    const completed = makeTodo({ is_completed: 1, is_important: 1 });
    expect(important.filter(completed)).toBe(false);
  });
  it('overdue section excludes important items', () => {
    const sections = getTodoSections();
    const overdue = sections.find(s => s.label === 'Due / Overdue')!;
    const importantOverdue = makeTodo({ is_important: 1, deadline: '2000-01-01' });
    expect(overdue.filter(importantOverdue)).toBe(false);
  });
  it('open section excludes items with past deadline', () => {
    const sections = getTodoSections();
    const open = sections.find(s => s.label === 'Open')!;
    const pastDue = makeTodo({ deadline: '2000-01-01' });
    expect(open.filter(pastDue)).toBe(false);
  });
});
