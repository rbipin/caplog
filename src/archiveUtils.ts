import { parseLocalDate, formatLocalDate } from './utils.js';

export interface DayData {
  date: string;
  entryCount: number;
  doneCount: number;
}

export interface WeekData {
  weekStart: string;
  days: DayData[];
  totalEntries: number;
  totalDone: number;
}

export function getWeekStart(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

export function buildWeeks(
  entryCounts: Record<string, number>,
  doneCounts: Record<string, number>,
  year: number
): Map<string, WeekData> {
  const weeks = new Map<string, WeekData>();

  const allDates = new Set([...Object.keys(entryCounts), ...Object.keys(doneCounts)]);
  for (const date of allDates) {
    const weekStart = getWeekStart(date);
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { weekStart, days: [], totalEntries: 0, totalDone: 0 });
    }
    const week = weeks.get(weekStart)!;
    const entryCount = entryCounts[date] ?? 0;
    const doneCount = doneCounts[date] ?? 0;
    week.days.push({ date, entryCount, doneCount });
    week.totalEntries += entryCount;
    week.totalDone += doneCount;
  }

  for (const week of weeks.values()) {
    const existing = new Set(week.days.map(d => d.date));
    const mon = parseLocalDate(week.weekStart);
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dateStr = formatLocalDate(d);
      if (!existing.has(dateStr) && d.getFullYear() === year) {
        week.days.push({ date: dateStr, entryCount: 0, doneCount: 0 });
      }
    }
    week.days.sort((a, b) => b.date.localeCompare(a.date));
  }

  return weeks;
}
