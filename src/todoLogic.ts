import { TodoItem } from './types.js';

export function todoStatus(todo: TodoItem): 'completed' | 'important' | 'overdue' | 'open' {
  if (todo.is_completed) return 'completed';
  if (todo.is_important) return 'important';
  if (todo.deadline) {
    const today = new Date().toISOString().split('T')[0];
    if (todo.deadline <= today) return 'overdue';
  }
  return 'open';
}

export function getTodoSections(): { label: string; filter: (t: TodoItem) => boolean }[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    { label: 'Important', filter: (t) => !t.is_completed && !!t.is_important },
    { label: 'Due / Overdue', filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
    { label: 'Open', filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
    { label: 'Completed today', filter: (t) => !!t.is_completed },
  ];
}
