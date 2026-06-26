import { describe, it, expect } from 'vitest';
import { buildDayLogs } from '../logAggregation.js';
import type { LogEntry, TodoItem } from '../types.js';

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    date: '2026-06-25',
    raw_text: 'raw',
    formatted_text: '<ul><li>did a thing</li></ul>',
    created_at: '2026-06-25T10:00:00.000',
    ...overrides,
  };
}

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

describe('buildDayLogs', () => {
  it('groups log entries by date and strips HTML from formatted_text', () => {
    const days = buildDayLogs(
      [entry({ formatted_text: '<ul><li>Meeting notes</li></ul>' })],
      []
    );
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-06-25');
    expect(days[0].items[0].text).toBe('Meeting notes');
    expect(days[0].items[0].text).not.toContain('<');
  });

  it('attaches completed todos to the day they were completed (by completed_at)', () => {
    const days = buildDayLogs(
      [entry({ date: '2026-06-25' })],
      [todo({ id: 7, text: 'Ship release', completed_at: '2026-06-25T14:00:00.000' })]
    );
    expect(days).toHaveLength(1);
    expect(days[0].completedTodos).toHaveLength(1);
    expect(days[0].completedTodos[0].text).toBe('Ship release');
  });

  it('uses completed_at (not created_at) for the day key', () => {
    // Created on the 24th, completed on the 25th — must land on the 25th.
    const days = buildDayLogs(
      [],
      [todo({ created_at: '2026-06-24T09:00:00.000', completed_at: '2026-06-25T08:00:00.000' })]
    );
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-06-25');
  });

  it('includes days that have only completed todos and no log entries', () => {
    const days = buildDayLogs(
      [entry({ date: '2026-06-25' })],
      [todo({ id: 9, text: 'Todo-only day', completed_at: '2026-06-20T11:00:00.000' })]
    );
    const todoOnly = days.find((d) => d.date === '2026-06-20');
    expect(todoOnly).toBeDefined();
    expect(todoOnly!.items).toHaveLength(0);
    expect(todoOnly!.completedTodos[0].text).toBe('Todo-only day');
  });

  it('sorts days by date descending', () => {
    const days = buildDayLogs(
      [entry({ date: '2026-06-20' }), entry({ date: '2026-06-25' })],
      [todo({ completed_at: '2026-06-22T10:00:00.000' })]
    );
    expect(days.map((d) => d.date)).toEqual(['2026-06-25', '2026-06-22', '2026-06-20']);
  });

  it('ignores todos with a null completed_at', () => {
    const days = buildDayLogs([], [todo({ completed_at: null })]);
    expect(days).toHaveLength(0);
  });

  it('preserves incoming order of items and completed todos within a day', () => {
    const days = buildDayLogs(
      [
        entry({ formatted_text: '<p>first</p>', created_at: '2026-06-25T09:00:00.000' }),
        entry({ formatted_text: '<p>second</p>', created_at: '2026-06-25T10:00:00.000' }),
      ],
      [
        todo({ id: 1, text: 'early', completed_at: '2026-06-25T11:00:00.000' }),
        todo({ id: 2, text: 'late', completed_at: '2026-06-25T15:00:00.000' }),
      ]
    );
    expect(days[0].items.map((i) => i.text)).toEqual(['first', 'second']);
    expect(days[0].completedTodos.map((t) => t.text)).toEqual(['early', 'late']);
  });
});
