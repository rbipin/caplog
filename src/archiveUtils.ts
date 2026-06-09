import { parseLocalDate } from './utils.js';

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
  return d.toISOString().split('T')[0];
}

export function buildWeeks(
  entryCounts: Record<string, number>,
  doneCounts: Record<string, number>,
  year: number
): Map<string, WeekData> {
  const weeks = new Map<string, WeekData>();

  for (const [date, entryCount] of Object.entries(entryCounts)) {
    const weekStart = getWeekStart(date);
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { weekStart, days: [], totalEntries: 0, totalDone: 0 });
    }
    const week = weeks.get(weekStart)!;
    week.totalEntries += entryCount;
    week.totalDone += doneCounts[date] ?? 0;
    week.days.push({ date, entryCount, doneCount: doneCounts[date] ?? 0 });
  }

  for (const [date, doneCount] of Object.entries(doneCounts)) {
    const weekStart = getWeekStart(date);
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { weekStart, days: [], totalEntries: 0, totalDone: 0 });
    }
    const week = weeks.get(weekStart)!;
    if (!week.days.find(d => d.date === date)) {
      week.days.push({ date, entryCount: 0, doneCount });
      week.totalDone += doneCount;
    }
  }

  for (const week of weeks.values()) {
    const existing = new Set(week.days.map(d => d.date));
    const mon = parseLocalDate(week.weekStart);
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      if (!existing.has(dateStr) && d.getFullYear() === year) {
        week.days.push({ date: dateStr, entryCount: 0, doneCount: 0 });
      }
    }
    week.days.sort((a, b) => b.date.localeCompare(a.date));
  }

  return weeks;
}
