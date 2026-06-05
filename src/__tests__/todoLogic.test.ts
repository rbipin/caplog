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

describe('getTodoSections — completed section', () => {
  it('returns no section with label "Archive"', () => {
    const sections = getTodoSections();
    expect(sections.find(s => s.label === 'Archive')).toBeUndefined();
  });

  it('completed todo (completed today) appears in Completed section', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const recent = makeTodo({ is_completed: 1, completed_at: new Date().toISOString() });
    expect(completed.filter(recent)).toBe(true);
  });

  it('completed todo with old completed_at still appears in Completed section', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const oldTodo = makeTodo({ is_completed: 1, completed_at: old.toISOString() });
    expect(completed.filter(oldTodo)).toBe(true);
  });

  it('completed todo with null completed_at appears in Completed section', () => {
    const sections = getTodoSections();
    const completed = sections.find(s => s.label === 'Completed')!;
    const noDate = makeTodo({ is_completed: 1, completed_at: null });
    expect(completed.filter(noDate)).toBe(true);
  });
});
