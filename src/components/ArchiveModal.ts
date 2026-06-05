import { query, execute } from '../db.js';
import { parseLocalDate, getToday } from '../utils.js';
import type { ArchiveConfirmModal } from './ArchiveConfirmModal.js';
import { buildWeeks } from '../archiveUtils.js';
import type { DayData, WeekData } from '../archiveUtils.js';

export class ArchiveModal {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private searchInput: HTMLInputElement;
  private yearLabel: HTMLElement;
  private currentYear: number;
  private today: string;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;

  constructor(
    private onDaySelect: (date: string) => void,
    private confirmModal: ArchiveConfirmModal
  ) {
    this.overlay = document.getElementById('archiveModal')!;
    this.body = document.getElementById('archiveBody')!;
    this.searchInput = document.getElementById('archiveSearchInput') as HTMLInputElement;
    this.yearLabel = document.getElementById('archiveYearLabel')!;
    this.currentYear = new Date().getFullYear();
    this.today = getToday();

    document.getElementById('archiveCloseBtn')!.addEventListener('click', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) {
        if (document.querySelector('.archive-confirm-overlay.visible')) return;
        this.hide();
      }
    });
    document.getElementById('archiveYearPrev')!.addEventListener('click', () => {
      this.currentYear--;
      void this.load();
    });
    document.getElementById('archiveYearNext')!.addEventListener('click', () => {
      if (this.currentYear < new Date().getFullYear()) {
        this.currentYear++;
        void this.load();
      }
    });
    this.searchInput.addEventListener('input', () => {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => void this.applySearch(), 200);
    });
  }

  show(): void {
    this.currentYear = new Date().getFullYear();
    this.searchInput.value = '';
    this.overlay.classList.add('visible');
    void this.load();
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }

  private async load(): Promise<void> {
    this.yearLabel.textContent = String(this.currentYear);
    const yearPrefix = `${this.currentYear}-%`;

    const [entryRows, doneRows] = await Promise.all([
      query<{ date: string; entry_count: number }>(
        'SELECT date, COUNT(*) as entry_count FROM log_entries WHERE date LIKE ? GROUP BY date ORDER BY date DESC',
        [yearPrefix]
      ),
      query<{ date: string; done_count: number }>(
        'SELECT DATE(completed_at) as date, COUNT(*) as done_count FROM todos WHERE completed_at LIKE ? GROUP BY DATE(completed_at)',
        [yearPrefix]
      ),
    ]);

    const entryCounts: Record<string, number> = {};
    for (const r of entryRows) entryCounts[r.date] = r.entry_count;

    const doneCounts: Record<string, number> = {};
    for (const r of doneRows) doneCounts[r.date] = r.done_count;

    const weeks = buildWeeks(entryCounts, doneCounts, this.currentYear);
    this.renderWeeks(weeks);
    if (this.searchInput.value.trim()) void this.applySearch();
  }

  private renderWeeks(weeks: Map<string, WeekData>): void {
    this.body.innerHTML = '';
    const sorted = Array.from(weeks.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    let lastMonth = '';
    for (const [, week] of sorted) {
      const yearStr = String(this.currentYear);
      const firstInYear = week.days
        .filter(d => d.date.startsWith(yearStr))
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      const monthKey = firstInYear ? firstInYear.date.substring(0, 7) : week.weekStart.substring(0, 7);

      if (monthKey !== lastMonth) {
        lastMonth = monthKey;
        const [yr, mo] = monthKey.split('-');
        const label = parseLocalDate(`${yr}-${mo}-01`).toLocaleString('en-US', {
          month: 'long', year: 'numeric',
        });
        const divider = document.createElement('div');
        divider.className = 'archive-month-divider';
        divider.innerHTML = `
          <div class="archive-month-line"></div>
          <div class="archive-month-label">${label}</div>
          <button class="archive-clean-btn" title="Delete ${label}">🗑</button>
          <div class="archive-month-line"></div>
        `;
        divider.querySelector('.archive-clean-btn')!.addEventListener('click', () => {
          void this.cleanMonth(monthKey);
        });
        this.body.appendChild(divider);
      }
      this.body.appendChild(this.renderWeekCard(week.weekStart, week));
    }
  }

  private renderWeekCard(weekStart: string, week: WeekData): HTMLElement {
    const d = parseLocalDate(weekStart);
    const weekLabel = `Week of ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;

    const statsHtml = [
      week.totalEntries > 0 ? `<span class="tag tag-log">${week.totalEntries} entries</span>` : '',
      week.totalDone > 0 ? `<span class="tag tag-todo">${week.totalDone} done</span>` : '',
    ].join('');

    const card = document.createElement('div');
    card.className = 'archive-week-card';
    card.dataset.weekStart = weekStart;
    card.innerHTML = `
      <div class="archive-week-header">
        <span class="archive-week-label">${weekLabel}</span>
        <div class="archive-week-stats">
          ${statsHtml}
          ${week.totalEntries > 0 ? `<button class="archive-clean-btn" title="Delete this week">🗑</button>` : ''}
        </div>
      </div>
      <div class="archive-week-days"></div>
    `;

    if (week.totalEntries > 0) {
      card.querySelector('.archive-clean-btn')!.addEventListener('click', () => {
        void this.cleanWeek(weekStart);
      });
    }

    const daysContainer = card.querySelector('.archive-week-days')!;
    for (const day of week.days) {
      daysContainer.appendChild(this.renderDayTile(day));
    }
    return card;
  }

  private renderDayTile(day: DayData): HTMLElement {
    const d = parseLocalDate(day.date);
    const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
    const isEmpty = day.entryCount === 0;
    const isToday = day.date === this.today;

    const tile = document.createElement('div');
    tile.className = 'archive-day-tile';
    tile.dataset.date = day.date;
    if (isEmpty) tile.classList.add('empty');
    if (isToday) tile.classList.add('today');

    tile.innerHTML = `
      <div class="archive-day-dow">${dow}</div>
      <div class="archive-day-num">${d.getDate()}</div>
      <div class="archive-day-count">${isEmpty ? '—' : `${day.entryCount} entries`}</div>
      ${!isEmpty ? `<button class="archive-clean-btn" title="Delete ${day.date}">🗑</button>` : ''}
    `;

    if (!isEmpty) {
      tile.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('archive-clean-btn')) return;
        this.onDaySelect(day.date);
      });
      tile.querySelector('.archive-clean-btn')!.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.cleanDay(day.date);
      });
    }
    return tile;
  }

  private async cleanRange(
    label: string,
    entryWhere: string,
    todoWhere: string,
    entryParams: (string | number)[],
    todoParams: (string | number)[]
  ): Promise<void> {
    const [entryRows, todoRows] = await Promise.all([
      query<{ count: number }>(`SELECT COUNT(*) as count FROM log_entries WHERE ${entryWhere}`, entryParams),
      query<{ count: number }>(`SELECT COUNT(*) as count FROM todos WHERE ${todoWhere}`, todoParams),
    ]);
    const entryCount = entryRows[0]?.count ?? 0;
    const todoCount = todoRows[0]?.count ?? 0;

    this.confirmModal.show(
      `Delete ${label}?`,
      `${entryCount} log entries and ${todoCount} todos will be permanently deleted. This cannot be undone.`,
      async () => {
        await Promise.all([
          execute(`DELETE FROM log_entries WHERE ${entryWhere}`, entryParams),
          execute(`DELETE FROM todos WHERE ${todoWhere}`, todoParams),
        ]);
        void this.load();
      }
    );
  }

  private async cleanDay(date: string): Promise<void> {
    const label = parseLocalDate(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    await this.cleanRange(label, 'date = ?', 'DATE(created_at) = ?', [date], [date]);
  }

  private async cleanWeek(weekStart: string): Promise<void> {
    const start = parseLocalDate(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const label = `Week of ${parseLocalDate(weekStart).toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
    await this.cleanRange(
      label,
      'date >= ? AND date <= ?',
      'DATE(created_at) >= ? AND DATE(created_at) <= ?',
      [weekStart, endDate],
      [weekStart, endDate]
    );
  }

  private async cleanMonth(yearMonth: string): Promise<void> {
    const [yr, mo] = yearMonth.split('-');
    const pattern = `${yearMonth}-%`;
    const label = parseLocalDate(`${yr}-${mo}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    await this.cleanRange(label, 'date LIKE ?', 'DATE(created_at) LIKE ?', [pattern], [pattern]);
  }

  private async applySearch(): Promise<void> {
    const seq = ++this.searchSeq;
    const q = this.searchInput.value.trim();
    if (!q) {
      this.clearSearchHighlights();
      return;
    }

    const matchingRows = await query<{ date: string }>(
      'SELECT DISTINCT date FROM log_entries WHERE date LIKE ? AND raw_text LIKE ?',
      [`${this.currentYear}-%`, `%${q}%`]
    );
    if (seq !== this.searchSeq) return;
    const matchingDates = new Set(matchingRows.map(r => r.date));

    for (const card of this.body.querySelectorAll<HTMLElement>('.archive-week-card')) {
      let cardHasMatch = false;
      for (const tile of card.querySelectorAll<HTMLElement>('.archive-day-tile')) {
        const date = tile.dataset.date!;
        tile.classList.remove('search-match', 'search-no-match');
        if (matchingDates.has(date)) {
          tile.classList.add('search-match');
          cardHasMatch = true;
        } else {
          tile.classList.add('search-no-match');
        }
      }
      card.classList.toggle('search-hidden', !cardHasMatch);
    }
  }

  private clearSearchHighlights(): void {
    this.body.querySelectorAll('.archive-day-tile').forEach(t => {
      t.classList.remove('search-match', 'search-no-match');
    });
    this.body.querySelectorAll('.archive-week-card').forEach(c => {
      c.classList.remove('search-hidden');
    });
  }
}
