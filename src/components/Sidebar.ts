import { query } from '../db.js';
import { escapeHtml, parseLocalDate } from '../utils.js';
import type { DayStats } from '../types.js';

export class Sidebar {
  private monthLabel: HTMLElement;
  private dayList: HTMLElement;
  private days: number = 3;

  constructor(private onDaySelect: (date: string) => void) {
    this.monthLabel = document.getElementById('sidebarMonthLabel')!;
    this.dayList = document.getElementById('dayList')!;
    const now = new Date();
    this.monthLabel.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  refresh(days?: number): Promise<void> {
    if (days !== undefined) this.days = days;
    return this.load();
  }

  private async load(): Promise<void> {
    const stats = await query<DayStats>(`
      SELECT
        l.date,
        COUNT(l.id) AS log_count,
        (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
        (SELECT raw_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
      FROM log_entries l
      GROUP BY l.date
      ORDER BY l.date DESC
      LIMIT ?
    `, [this.days]);

    this.dayList.innerHTML = '';
    stats.forEach((s, i) => this.dayList.appendChild(this.renderEntry(s, i === 0)));
  }

  private renderEntry(s: DayStats, active: boolean): HTMLElement {
    const d = parseLocalDate(s.date);
    const dowNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dow = dowNames[d.getDay()];
    const day = d.getDate();

    const metaTags: string[] = [];
    if (s.log_count > 0) metaTags.push(`<span class="tag tag-log">${s.log_count} entries</span>`);
    if (s.todo_done_count > 0) metaTags.push(`<span class="tag tag-todo">${s.todo_done_count} done</span>`);

    const el = document.createElement('div');
    el.className = `day-entry${active ? ' active' : ''}`;
    el.innerHTML = `
      <div class="day-entry-date">
        <div class="day-entry-dow">${dow}</div>
        <div class="day-entry-num">${day}</div>
      </div>
      <div>
        <div class="day-entry-preview">${escapeHtml(s.preview ?? '')}</div>
        <div class="day-entry-meta">${metaTags.join('')}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      document.querySelectorAll('.day-entry').forEach((e) => e.classList.remove('active'));
      el.classList.add('active');
      this.onDaySelect(s.date);
    });
    return el;
  }
}
