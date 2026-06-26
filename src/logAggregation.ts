import type { LogEntry, TodoItem } from './types.js';
import { formatTime } from './utils.js';

export interface DayLogItem {
  /** Markdown content of the log entry (rendered via the shared Markdown component). */
  text: string;
  time: string;
}

export interface DayLog {
  /** Local date key, `YYYY-MM-DD`. */
  date: string;
  items: DayLogItem[];
  completedTodos: TodoItem[];
}

/**
 * Aggregates log entries and completed todos into per-day buckets, sorted by
 * date descending. Days that have only completed todos (no log entries) are
 * included. Within a day, log items keep their incoming order (expected to be
 * `created_at` ascending) and completed todos keep theirs (`completed_at`
 * ascending).
 *
 * `completed_at` is stored as a local timestamp (`YYYY-MM-DDTHH:MM:SS.mmm`), so
 * the day key is the first 10 characters — matching SQLite's `DATE()`.
 */
export function buildDayLogs(entries: LogEntry[], completedTodos: TodoItem[]): DayLog[] {
  const byDate = new Map<string, DayLog>();

  const dayFor = (date: string): DayLog => {
    let day = byDate.get(date);
    if (!day) {
      day = { date, items: [], completedTodos: [] };
      byDate.set(date, day);
    }
    return day;
  };

  for (const e of entries) {
    dayFor(e.date).items.push({ text: e.formatted_text, time: formatTime(e.created_at) });
  }

  for (const t of completedTodos) {
    if (!t.completed_at) continue;
    dayFor(t.completed_at.slice(0, 10)).completedTodos.push(t);
  }

  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}
