import type { LogEntry, TodoItem } from './types.js';

export type FeedItem =
  | { kind: 'log'; sortKey: string; entry: LogEntry }
  | { kind: 'todo-created'; sortKey: string; todo: TodoItem }
  | { kind: 'todo-completed'; sortKey: string; todo: TodoItem };

export interface FeedDay {
  /** Local date key, `YYYY-MM-DD`. */
  date: string;
  isToday: boolean;
  /** Open todos created before today, pinned above today's items. Always empty for past days. */
  carriedOver: TodoItem[];
  items: FeedItem[];
}

function carryRank(t: TodoItem, today: string): number {
  if (t.is_important) return 0;
  if (t.deadline && t.deadline <= today) return 1;
  return 2;
}

/**
 * Assembles the chat feed from recent log entries and the windowed todo list,
 * grouped into day sections (newest first). Mirrors the legacy `loadRecentEntries`
 * behavior: a day gets a section if it has log entries, completed todos, or is today.
 *
 * Within a day, items are ordered by their timestamp (log/created → `created_at`,
 * a separate completion → `completed_at`). A todo created and completed on the same
 * day renders as completed.
 *
 * Open todos created before today are carried over: they appear only in today's
 * `carriedOver` list (Important → Due/Overdue → Open), never in their creation day.
 * A completed todo appears only on the day it was completed.
 */
export function buildFeed(entries: LogEntry[], todos: TodoItem[], today: string): FeedDay[] {
  const dates = new Set<string>();
  for (const e of entries) dates.add(e.date);
  for (const t of todos) if (t.completed_at) dates.add(t.completed_at.slice(0, 10));
  dates.add(today);

  const sorted = Array.from(dates).sort((a, b) => b.localeCompare(a));

  return sorted.map((date) => {
    const dayEntries = entries.filter((e) => e.date === date);
    const completedTodos = todos.filter(
      (t) => t.completed_at && t.completed_at.slice(0, 10) === date
    );
    const completedIds = new Set(completedTodos.map((t) => t.id));
    const isToday = date === today;
    const createdTodos = todos.filter(
      (t) => t.created_at.startsWith(date) && (completedIds.has(t.id) || (isToday && !t.is_completed))
    );
    const carriedOver = isToday
      ? todos
          .filter((t) => !t.is_completed && t.created_at.slice(0, 10) < today)
          .sort((a, b) => carryRank(a, today) - carryRank(b, today))
      : [];

    const items: FeedItem[] = [
      ...dayEntries.map((entry) => ({ kind: 'log' as const, sortKey: entry.created_at, entry })),
      ...createdTodos.map((todo) =>
        completedIds.has(todo.id)
          ? { kind: 'todo-completed' as const, sortKey: todo.created_at, todo }
          : { kind: 'todo-created' as const, sortKey: todo.created_at, todo }
      ),
      ...completedTodos
        .filter((t) => !t.created_at.startsWith(date))
        .map((todo) => ({ kind: 'todo-completed' as const, sortKey: todo.completed_at!, todo })),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return { date, isToday, carriedOver, items };
  });
}
