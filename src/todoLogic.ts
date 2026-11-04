import type { TodoItem } from './types.js';
import { getToday, parseLocalDate } from './utils.js';

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

const DUE_SOON_DAYS = 3;

/** Days left (1..3) for an open todo whose deadline is near; null otherwise. */
export function daysUntilDue(todo: TodoItem): 1 | 2 | 3 | null {
  if (todoStatus(todo) !== 'open' || !todo.deadline) return null;
  const ms = parseLocalDate(todo.deadline).getTime() - parseLocalDate(getToday()).getTime();
  const days = Math.round(ms / 86_400_000);
  return days >= 1 && days <= DUE_SOON_DAYS ? (days as 1 | 2 | 3) : null;
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
