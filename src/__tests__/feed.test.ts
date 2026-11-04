import { describe, it, expect } from 'vitest';
import { buildFeed } from '../feed';
import type { LogEntry, TodoItem } from '../types';

function entry(over: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    date: '2026-06-26',
    raw_text: 'hi',
    formatted_text: '- hi',
    created_at: '2026-06-26T09:00:00.000',
    ...over,
  };
}

function todo(over: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 1,
    text: 'task',
    is_completed: 0,
    is_important: 0,
    deadline: null,
    created_at: '2026-06-26T08:00:00.000',
    completed_at: null,
    ...over,
  } as TodoItem;
}

const TODAY = '2026-06-26';

describe('buildFeed', () => {
  it('always includes a today section even when empty', () => {
    const days = buildFeed([], [], TODAY);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe(TODAY);
    expect(days[0].isToday).toBe(true);
    expect(days[0].items).toEqual([]);
  });

  it('groups log entries and todos into their day, newest day first', () => {
    const days = buildFeed(
      [entry({ id: 1, date: '2026-06-25', created_at: '2026-06-25T10:00:00.000' })],
      [todo({ id: 2, created_at: '2026-06-26T08:00:00.000' })],
      TODAY
    );
    expect(days.map((d) => d.date)).toEqual(['2026-06-26', '2026-06-25']);
    expect(days[0].items[0]).toMatchObject({ kind: 'todo-created' });
    expect(days[1].items[0]).toMatchObject({ kind: 'log' });
  });

  it('renders a todo created and completed the same day as completed', () => {
    const days = buildFeed(
      [],
      [todo({ id: 3, created_at: '2026-06-26T08:00:00.000', is_completed: 1, completed_at: '2026-06-26T12:00:00.000' })],
      TODAY
    );
    expect(days[0].items).toHaveLength(1);
    expect(days[0].items[0].kind).toBe('todo-completed');
  });

  it('shows a separate completion entry on the completion day for an older todo', () => {
    const days = buildFeed(
      [],
      [todo({ id: 4, created_at: '2026-06-20T08:00:00.000', is_completed: 1, completed_at: '2026-06-26T09:00:00.000' })],
      TODAY
    );
    const today = days.find((d) => d.date === TODAY)!;
    expect(today.items).toHaveLength(1);
    expect(today.items[0]).toMatchObject({ kind: 'todo-completed', sortKey: '2026-06-26T09:00:00.000' });
  });

  it('orders items within a day by timestamp ascending', () => {
    const days = buildFeed(
      [entry({ id: 1, date: TODAY, created_at: '2026-06-26T11:00:00.000' })],
      [todo({ id: 2, created_at: '2026-06-26T07:00:00.000' })],
      TODAY
    );
    const kinds = days[0].items.map((i) => i.kind);
    expect(kinds).toEqual(['todo-created', 'log']);
  });

  it('carries an older open todo into today only, not its creation day', () => {
    const days = buildFeed(
      [entry({ id: 1, date: '2026-06-20', created_at: '2026-06-20T10:00:00.000' })],
      [todo({ id: 6, created_at: '2026-06-20T08:00:00.000' })],
      TODAY
    );
    expect(days.find((d) => d.date === TODAY)!.carriedOver.map((t) => t.id)).toEqual([6]);
    const old = days.find((d) => d.date === '2026-06-20')!;
    expect(old.carriedOver).toEqual([]);
    expect(old.items.map((i) => i.kind)).toEqual(['log']);
  });

  it('orders carried-over todos Important, Due/Overdue, then Open', () => {
    const created_at = '2026-06-20T08:00:00.000';
    const days = buildFeed(
      [],
      [
        todo({ id: 1, created_at }),
        todo({ id: 2, created_at, deadline: '2026-06-25' }),
        todo({ id: 3, created_at, is_important: 1 }),
      ],
      TODAY
    );
    expect(days[0].carriedOver.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('keeps an open todo created today inline, not carried over', () => {
    const days = buildFeed([], [todo({ id: 7 })], TODAY);
    expect(days[0].carriedOver).toEqual([]);
    expect(days[0].items[0]).toMatchObject({ kind: 'todo-created' });
  });

  it('shows a todo completed later only on its completion day', () => {
    const days = buildFeed(
      [],
      [todo({ id: 8, created_at: '2026-06-24T08:00:00.000', is_completed: 1, completed_at: '2026-06-25T09:00:00.000' })],
      TODAY
    );
    expect(days.find((d) => d.date === '2026-06-24')).toBeUndefined();
    expect(days.find((d) => d.date === '2026-06-25')!.items[0].kind).toBe('todo-completed');
    expect(days.find((d) => d.date === TODAY)!.carriedOver).toEqual([]);
  });
});
