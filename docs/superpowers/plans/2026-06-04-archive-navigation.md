# Archive Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen Archive overlay that lets users browse historical log entries organized by week, navigate by year, and search across all entries.

**Architecture:** A new `ArchiveModal` TypeScript class manages a full-screen overlay (added to `index.html`). It queries SQLite for year-level data using existing `query()` from `src/db.ts`, groups dates into weeks client-side, and renders week cards with day tiles. An "Archive" button is added to the sidebar header. `App` wires the callback so that clicking a day tile closes the archive and opens the existing `LogModal` for that day.

**Tech Stack:** TypeScript (vanilla), Tauri v2, SQLite via `src/db.ts` `query()`, Vitest + happy-dom for tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `index.html` | Archive overlay DOM + sidebar Archive button |
| Modify | `src/styles.css` | Archive modal CSS classes |
| Create | `src/components/ArchiveModal.ts` | Full archive component (data loading, rendering, search, year nav) |
| Modify | `src/app.ts` | Import + instantiate `ArchiveModal`, wire Archive button |
| Create | `src/__tests__/components/ArchiveModal.test.ts` | Integration tests |
| Modify | `src/__tests__/components/ChatArea.test.ts` | Add archive elements to `FULL_DOM` |
| Modify | `src/__tests__/components/SettingsModal.test.ts` | Add archive elements to `FULL_DOM` |
| Modify | `src/__tests__/components/TodoPanel.test.ts` | Add archive elements to `FULL_DOM` |

---

## Task 1: HTML Scaffolding

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add sidebar Archive button**

In `index.html`, replace:
```html
<aside class="sidebar" id="sidebar">
  <div class="sidebar-section-title" id="sidebarMonthLabel"></div>
  <div id="dayList"></div>
</aside>
```
with:
```html
<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-section-title" id="sidebarMonthLabel"></div>
    <button class="btn-ghost sidebar-archive-btn" id="archiveBtn">⊞ Archive</button>
  </div>
  <div id="dayList"></div>
</aside>
```

- [ ] **Step 2: Add archive overlay**

Before the closing `</body>` tag (after the Settings Modal block), add:
```html
<!-- Archive Modal -->
<div class="archive-overlay" id="archiveModal">
  <div class="archive-header">
    <span class="archive-title">Archive</span>
    <input class="archive-search" id="archiveSearchInput" placeholder="Search entries..." />
    <div class="archive-year-nav">
      <button class="btn-ghost" id="archiveYearPrev">◀</button>
      <span class="archive-year-label" id="archiveYearLabel"></span>
      <button class="btn-ghost" id="archiveYearNext">▶</button>
    </div>
    <button class="modal-close" id="archiveCloseBtn">✕</button>
  </div>
  <div class="archive-body" id="archiveBody"></div>
</div>
```

- [ ] **Step 3: Verify build is clean**

Run: `pnpm build`
Expected: exits with code 0, no TypeScript or Vite errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add archive overlay and sidebar button HTML scaffold"
```

---

## Task 2: CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append archive CSS to the end of `src/styles.css`**

```css
/* ── Archive modal ── */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 12px;
}

.sidebar-archive-btn {
  font-size: 11px;
  padding: 3px 8px;
  flex-shrink: 0;
}

.archive-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: none;
  flex-direction: column;
  z-index: 100;
}

.archive-overlay.visible {
  display: flex;
}

.archive-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.archive-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 18px;
  color: var(--accent);
  white-space: nowrap;
}

.archive-search {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 6px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.archive-search::placeholder { color: var(--text-dim); }
.archive-search:focus { border-color: var(--accent); }

.archive-year-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.archive-year-label {
  font-size: 13px;
  color: var(--accent);
  min-width: 40px;
  text-align: center;
  letter-spacing: 0.05em;
}

.archive-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.archive-month-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 28px 0 14px;
}

.archive-month-divider:first-child { margin-top: 0; }

.archive-month-line {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.archive-month-label {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.archive-week-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 8px;
  transition: border-color 0.15s;
}

.archive-week-card:hover { border-color: var(--border-hover); }
.archive-week-card.search-hidden { display: none; }

.archive-week-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.archive-week-label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.archive-week-stats { display: flex; gap: 6px; }

.archive-week-days {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.archive-day-tile {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-left: 2px solid transparent;
  border-radius: 4px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.12s;
  min-width: 72px;
}

.archive-day-tile:hover {
  border-color: var(--border-hover);
  border-left-color: var(--accent);
  background: #242424;
}

.archive-day-tile.today {
  border-left-color: var(--accent);
  background: var(--accent-dim);
}

.archive-day-tile.empty {
  opacity: 0.3;
  cursor: default;
}

.archive-day-tile.empty:hover {
  border-color: var(--border);
  border-left-color: transparent;
  background: var(--surface-2);
}

.archive-day-tile.search-match { border-left-color: var(--accent); }
.archive-day-tile.search-no-match { opacity: 0.25; }

.archive-day-dow {
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: 0.08em;
}

.archive-day-tile.today .archive-day-dow { color: var(--accent); }

.archive-day-num {
  font-family: var(--font-serif);
  font-size: 22px;
  color: var(--text);
  line-height: 1.1;
  margin: 2px 0;
}

.archive-day-tile.today .archive-day-num { color: var(--accent); }

.archive-day-count {
  font-size: 10px;
  color: var(--text-dim);
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: clean exit, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add archive modal CSS"
```

---

## Task 3: ArchiveModal Component (TDD)

**Files:**
- Create: `src/__tests__/components/ArchiveModal.test.ts`
- Create: `src/components/ArchiveModal.ts`

- [ ] **Step 1: Write the test file**

Create `src/__tests__/components/ArchiveModal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db.js', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  query: queryMock,
  execute: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../llm/factory.js', () => ({ getAdapter: vi.fn().mockResolvedValue(null) }));
vi.mock('../../export.js', () => ({ exportMarkdown: vi.fn() }));
vi.mock('../../ai.js', () => ({ formatLogEntry: vi.fn().mockResolvedValue('<ul><li>ok</li></ul>') }));

const FULL_DOM = `<div id="app">
  <div id="sidebarMonthLabel"></div><div id="dayList"></div>
  <div id="chatArea"></div>
  <div id="todoList"></div><div id="todoCount"></div>
  <div id="headerDate"></div>
  <textarea id="chatInput"></textarea><button id="sendBtn">Send</button>
  <button id="sidebarToggleBtn"></button><button id="viewLogBtn"></button>
  <button id="settingsBtn"></button><button id="exportBtn"></button>
  <button id="archiveBtn"></button>
  <div id="logModal"><div id="modalSubtitle"></div><div id="modalBody"></div>
    <button id="modalCloseBtn"></button><button id="modalFooterCloseBtn"></button>
    <button id="modalExportBtn"></button></div>
  <div id="settingsModal">
    <select id="llmProviderSelect"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
    <input id="apiKeyInput" /><input id="llmModelInput" /><input id="llmBaseUrlInput" />
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" />
    <button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
  </div>
  <div class="archive-overlay" id="archiveModal">
    <input class="archive-search" id="archiveSearchInput" placeholder="Search entries..." />
    <button id="archiveYearPrev">◀</button>
    <span id="archiveYearLabel"></span>
    <button id="archiveYearNext">▶</button>
    <button id="archiveCloseBtn">✕</button>
    <div id="archiveBody"></div>
  </div>
</div>`;

describe('ArchiveModal', () => {
  beforeAll(async () => {
    document.body.innerHTML = FULL_DOM;
    queryMock.mockResolvedValue([]);
    await import('../../app.js');
    await new Promise(r => setTimeout(r, 60));
  });

  beforeEach(() => {
    queryMock.mockResolvedValue([]);
    document.getElementById('archiveModal')!.classList.remove('visible');
    document.getElementById('archiveBody')!.innerHTML = '';
    (document.getElementById('archiveSearchInput') as HTMLInputElement).value = '';
  });

  it('is hidden by default', () => {
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('shows when Archive button is clicked', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(true);
  });

  it('hides when close button is clicked', () => {
    document.getElementById('archiveModal')!.classList.add('visible');
    document.getElementById('archiveCloseBtn')!.click();
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('hides when Escape is pressed', () => {
    document.getElementById('archiveModal')!.classList.add('visible');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('shows current year in year label on open', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.getElementById('archiveYearLabel')!.textContent).toBe(String(new Date().getFullYear()));
  });

  it('renders week cards from DB data', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) {
        return [
          { date: '2026-06-02', entry_count: 5 },
          { date: '2026-06-03', entry_count: 3 },
        ];
      }
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.querySelectorAll('.archive-week-card').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.archive-day-tile').length).toBeGreaterThan(0);
  });

  it('marks today tile with today class', async () => {
    const today = new Date().toISOString().split('T')[0];
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) return [{ date: today, entry_count: 3 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    expect(document.querySelector('.archive-day-tile.today')).not.toBeNull();
  });

  it('hides archive and shows day modal when a day tile is clicked', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) return [{ date: '2026-06-03', entry_count: 4 }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const tile = document.querySelector<HTMLElement>('.archive-day-tile:not(.empty)');
    expect(tile).not.toBeNull();
    tile!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveModal')!.classList.contains('visible')).toBe(false);
  });

  it('navigates to previous year', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    const currentYear = new Date().getFullYear();

    document.getElementById('archiveYearPrev')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveYearLabel')!.textContent).toBe(String(currentYear - 1));
  });

  it('does not navigate past the current year', async () => {
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));
    const currentYear = new Date().getFullYear();

    document.getElementById('archiveYearNext')!.click();
    await new Promise(r => setTimeout(r, 60));

    expect(document.getElementById('archiveYearLabel')!.textContent).toBe(String(currentYear));
  });

  it('highlights matching day tiles on search', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('log_entries') && sql.includes('COUNT')) return [{ date: '2026-06-03', entry_count: 2 }];
      if (sql.includes('DISTINCT') && sql.includes('raw_text LIKE')) return [{ date: '2026-06-03' }];
      return [];
    });
    document.getElementById('archiveBtn')!.click();
    await new Promise(r => setTimeout(r, 60));

    const input = document.getElementById('archiveSearchInput') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 300));

    expect(document.querySelector('.archive-day-tile.search-match')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/__tests__/components/ArchiveModal.test.ts`
Expected: failures — `archiveBtn` click does nothing, `ArchiveModal` not yet wired.

- [ ] **Step 3: Create `src/components/ArchiveModal.ts`**

```typescript
import { query } from '../db.js';

interface DayData {
  date: string;
  entryCount: number;
  doneCount: number;
}

interface WeekData {
  weekStart: string;
  days: DayData[];
  totalEntries: number;
  totalDone: number;
}

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
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

  // Fill Mon–Fri skeletons for days with no entries (within the given year only)
  for (const week of weeks.values()) {
    const existing = new Set(week.days.map(d => d.date));
    const mon = new Date(week.weekStart + 'T00:00:00');
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

export class ArchiveModal {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private searchInput: HTMLInputElement;
  private yearLabel: HTMLElement;
  private currentYear: number;
  private today: string;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private onDaySelect: (date: string) => void) {
    this.overlay = document.getElementById('archiveModal')!;
    this.body = document.getElementById('archiveBody')!;
    this.searchInput = document.getElementById('archiveSearchInput') as HTMLInputElement;
    this.yearLabel = document.getElementById('archiveYearLabel')!;
    this.currentYear = new Date().getFullYear();
    this.today = new Date().toISOString().split('T')[0];

    document.getElementById('archiveCloseBtn')!.addEventListener('click', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.hide();
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
  }

  private renderWeeks(weeks: Map<string, WeekData>): void {
    this.body.innerHTML = '';
    const sorted = Array.from(weeks.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    let lastMonth = '';
    for (const [weekStart, week] of sorted) {
      const monthKey = weekStart.substring(0, 7);
      if (monthKey !== lastMonth) {
        lastMonth = monthKey;
        const [yr, mo] = monthKey.split('-');
        const label = new Date(`${yr}-${mo}-01T00:00:00`).toLocaleString('en-US', {
          month: 'long', year: 'numeric',
        });
        const divider = document.createElement('div');
        divider.className = 'archive-month-divider';
        divider.innerHTML = `
          <div class="archive-month-line"></div>
          <div class="archive-month-label">${label}</div>
          <div class="archive-month-line"></div>
        `;
        this.body.appendChild(divider);
      }
      this.body.appendChild(this.renderWeekCard(weekStart, week));
    }
  }

  private renderWeekCard(weekStart: string, week: WeekData): HTMLElement {
    const d = new Date(weekStart + 'T00:00:00');
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
        <div class="archive-week-stats">${statsHtml}</div>
      </div>
      <div class="archive-week-days"></div>
    `;

    const daysContainer = card.querySelector('.archive-week-days')!;
    for (const day of week.days) {
      daysContainer.appendChild(this.renderDayTile(day));
    }
    return card;
  }

  private renderDayTile(day: DayData): HTMLElement {
    const d = new Date(day.date + 'T00:00:00');
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
    `;

    if (!isEmpty) {
      tile.addEventListener('click', () => {
        this.hide();
        this.onDaySelect(day.date);
      });
    }
    return tile;
  }

  private async applySearch(): Promise<void> {
    const q = this.searchInput.value.trim();
    if (!q) {
      this.clearSearchHighlights();
      return;
    }

    const matchingRows = await query<{ date: string }>(
      'SELECT DISTINCT date FROM log_entries WHERE date LIKE ? AND raw_text LIKE ?',
      [`${this.currentYear}-%`, `%${q}%`]
    );
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
```

- [ ] **Step 4: Run tests — still failing (not wired into App)**

Run: `pnpm test src/__tests__/components/ArchiveModal.test.ts`
Expected: failures on interaction tests — Archive button has no listener yet.

---

## Task 4: Wire ArchiveModal into App + Fix Test DOMs

**Files:**
- Modify: `src/app.ts`
- Modify: `src/__tests__/components/ChatArea.test.ts`
- Modify: `src/__tests__/components/SettingsModal.test.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Update `src/app.ts`**

Add import after the existing imports:
```typescript
import { ArchiveModal } from './components/ArchiveModal.js';
```

Add field to the `App` class (after `private inputHandler!: InputHandler;`):
```typescript
private archive: ArchiveModal;
```

In the `App` constructor, after `this.settings = new SettingsModal();`:
```typescript
this.archive = new ArchiveModal((date) => { void this.openDayModal(date); });
```

In `initHeader()`, after `document.getElementById('settingsBtn')!.addEventListener(...)`:
```typescript
document.getElementById('archiveBtn')!.addEventListener('click', () => this.archive.show());
```

- [ ] **Step 2: Add archive elements to `FULL_DOM` in all three existing test files**

In each of these files — `ChatArea.test.ts`, `SettingsModal.test.ts`, `TodoPanel.test.ts` — find the `FULL_DOM` constant and add the following immediately before the closing `</div>` of the outer `<div id="app">`:

```
  <button id="archiveBtn"></button>
  <div class="archive-overlay" id="archiveModal">
    <input class="archive-search" id="archiveSearchInput" />
    <button id="archiveYearPrev">◀</button>
    <span id="archiveYearLabel"></span>
    <button id="archiveYearNext">▶</button>
    <button id="archiveCloseBtn">✕</button>
    <div id="archiveBody"></div>
  </div>
```

Also add `<button id="modalExportBtn"></button>` inside the `logModal` div in each test file if not already present (the `LogModal` constructor binds a listener to it).

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: all tests pass, including the new `ArchiveModal.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ArchiveModal.ts src/app.ts \
  src/__tests__/components/ArchiveModal.test.ts \
  src/__tests__/components/ChatArea.test.ts \
  src/__tests__/components/SettingsModal.test.ts \
  src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: implement ArchiveModal and wire into App"
```

---

## Task 5: Manual Verification

**Files:** none (dev server only)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Open `http://localhost:1420`.

- [ ] **Step 2: Verify sidebar button**

Expected: "⊞ Archive" button appears in sidebar header, styled as `.btn-ghost` (amber on hover).

- [ ] **Step 3: Open archive**

Click Archive button.
Expected: full-screen overlay appears with amber *Archive* title, search input, year label (current year), and week cards for any existing entries.

- [ ] **Step 4: Close**

Click ✕ or press Escape.
Expected: overlay closes, app returns to normal.

- [ ] **Step 5: Year navigation**

Click ◀.
Expected: year label decrements, week cards reload for that year (likely empty). Click ▶ to return to current year — ▶ should be disabled at the current year.

- [ ] **Step 6: Day tile click**

Click a non-empty day tile (entry count > 0).
Expected: archive closes, `LogModal` opens showing that day's entries.

- [ ] **Step 7: Search**

Type a word that appears in an existing log entry.
Expected: after ~200ms, matching day tiles get amber left border (`.search-match`), non-matching tiles dim (`.search-no-match`), weeks with no matches collapse. Clear the input — all tiles return to normal.

- [ ] **Step 8: Commit any fixes**

```bash
git add -p
git commit -m "fix: archive navigation manual verification fixes"
```
