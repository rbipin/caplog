import type { TodoItem } from './types.js';
import { getToday } from './utils.js';

export type TodoSection = {
  label: string;
  filter: (t: TodoItem) => boolean;
  collapsed?: boolean;
};

export function todoStatus(todo: TodoItem): 'completed' | 'important' | 'overdue' | 'open' {
  if (todo.is_completed) return 'completed';
  if (todo.is_important) return 'important';
  if (todo.deadline) {
    const today = getToday();
    if (todo.deadline <= today) return 'overdue';
  }
  return 'open';
}

export function getTodoSections(): TodoSection[] {
  const today = getToday();

  return [
    { label: 'Important',     filter: (t) => !t.is_completed && !!t.is_important },
    { label: 'Due / Overdue', filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
    { label: 'Open',          filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
    { label: 'Completed',     filter: (t) => !!t.is_completed },
  ];
}
