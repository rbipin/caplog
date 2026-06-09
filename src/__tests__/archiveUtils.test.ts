import { describe, it, expect } from 'vitest';
import { buildWeeks } from '../archiveUtils.js';

describe('buildWeeks', () => {
  it('includes a day that has only completed todos and no log entries', () => {
    const entryCounts = {};
    const doneCounts = { '2026-06-03': 2 };
    const weeks = buildWeeks(entryCounts, doneCounts, 2026);

    const allDays = Array.from(weeks.values()).flatMap(w => w.days);
    const day = allDays.find(d => d.date === '2026-06-03');
    expect(day).toBeDefined();
    expect(day!.entryCount).toBe(0);
    expect(day!.doneCount).toBe(2);
  });

  it('does not duplicate a day that has both log entries and completed todos', () => {
    const entryCounts = { '2026-06-03': 4 };
    const doneCounts = { '2026-06-03': 1 };
    const weeks = buildWeeks(entryCounts, doneCounts, 2026);

    const allDays = Array.from(weeks.values()).flatMap(w => w.days);
    const matches = allDays.filter(d => d.date === '2026-06-03');
    expect(matches).toHaveLength(1);
    expect(matches[0].entryCount).toBe(4);
    expect(matches[0].doneCount).toBe(1);
  });

  it('counts totalDone correctly for todos-only days', () => {
    const entryCounts = {};
    const doneCounts = { '2026-06-03': 3 };
    const weeks = buildWeeks(entryCounts, doneCounts, 2026);

    const week = Array.from(weeks.values())[0];
    expect(week.totalDone).toBe(3);
    expect(week.totalEntries).toBe(0);
  });
});
