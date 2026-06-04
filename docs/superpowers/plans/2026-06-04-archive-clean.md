# Archive Clean Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Pending

**Goal:** Add hover trash icons to month dividers, week cards, and day tiles in the Archive overlay, each triggering a confirmation dialog that permanently deletes all log entries and todos for that period.

**Architecture:** A new `ArchiveConfirmModal` component manages the centered confirmation dialog DOM. `ArchiveModal` receives it via constructor and calls `confirmModal.show()` when a clean icon is clicked, passing the period label, counts, and a delete callback. Deletes run via `execute()` from `src/db.ts` — the same pattern used throughout the app. No Rust commands needed.

**Prerequisite:** `docs/superpowers/plans/2026-06-04-archive-navigation.md` must be fully executed first. This plan modifies `ArchiveModal.ts`, which that plan creates.

**Tech Stack:** TypeScript (vanilla), SQLite via `src/db.ts` `execute()` + `query()`, Vitest + happy-dom for tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `index.html` | Add `#archiveConfirmModal` DOM |
| Modify | `src/styles.css` | `.archive-clean-btn`, `.btn-danger`, `.archive-confirm-*` styles |
| Create | `src/components/ArchiveConfirmModal.ts` | Confirm dialog: `show(title, body, onConfirm)` / `hide()` |
| Modify | `src/components/ArchiveModal.ts` | Add clean icons + `cleanDay/cleanWeek/cleanMonth` methods; accept `ArchiveConfirmModal` in constructor |
| Modify | `src/app.ts` | Instantiate `ArchiveConfirmModal`, pass to `ArchiveModal` |
| Modify | `src/__tests__/components/ArchiveModal.test.ts` | Add `executeMock`, add confirm DOM to `FULL_DOM`, add clean tests |
| Modify | `src/__tests__/components/ChatArea.test.ts` | Add confirm DOM to `FULL_DOM` |
| Modify | `src/__tests__/components/SettingsModal.test.ts` | Add confirm DOM to `FULL_DOM` |
| Modify | `src/__tests__/components/TodoPanel.test.ts` | Add confirm DOM to `FULL_DOM` |

---

## Task 1: HTML Scaffold

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add confirmation dialog DOM**

In `index.html`, after the closing `<!-- Archive Modal -->` block (before `</body>`), add:

```html
<!-- Archive Confirm Modal -->
<div class="archive-confirm-overlay" id="archiveConfirmModal">
  <div class="archive-confirm-card">
    <div class="archive-confirm-title" id="archiveConfirmTitle"></div>
    <div class="archive-confirm-body" id="archiveConfirmBody"></div>
    <div class="archive-confirm-actions">
      <button class="btn-ghost" id="archiveConfirmCancelBtn">Cancel</button>
      <button class="btn-danger" id="archiveConfirmDeleteBtn">Delete</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: exits with code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add archive confirm dialog HTML scaffold"
```

---

## Task 2: CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add `position: relative` to `.archive-day-tile`**

Find the existing `.archive-day-tile` rule in `src/styles.css` and add `position: relative;`:

```css
.archive-day-tile {
  position: relative;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-left: 2px solid transparent;
  border-radius: 4px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.12s;
  min-width: 72px;
}
```

- [ ] **Step 2: Append clean + confirm CSS to `src/styles.css`**

At the very end of `src/styles.css`, append:

```css
/* ── Archive clean ── */
.archive-clean-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-dim);
  padding: 2px 4px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s;
  flex-shrink: 0;
}

.archive-day-tile .archive-clean-btn {
  position: absolute;
  top: 4px;
  right: 4px;
}

.archive-day-tile:hover .archive-clean-btn,
.archive-week-header:hover .archive-clean-btn,
.archive-month-divider:hover .archive-clean-btn {
  opacity: 1;
}

.archive-clean-btn:hover { color: #c0392b; }

.btn-danger {
  background: #c0392b;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
}

.btn-danger:hover { background: #a93226; }

.archive-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 101;
}

.archive-confirm-overlay.visible { display: flex; }

.archive-confirm-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.archive-confirm-title {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--text);
  margin-bottom: 10px;
}

.archive-confirm-body {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 20px;
  line-height: 1.5;
}

.archive-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: clean exit, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: add archive clean and confirm dialog CSS"
```

---

## Task 3: ArchiveConfirmModal Component (TDD)

**Files:**
- Create: `src/components/ArchiveConfirmModal.ts`

- [ ] **Step 1: Write tests for ArchiveConfirmModal**

The `ArchiveConfirmModal` tests live inside `ArchiveModal.test.ts` (Task 4 extends it). For now, write a focused unit test by temporarily appending to the bottom of `src/__tests__/components/ArchiveModal.test.ts`. First open that file, then add this `describe` block at the bottom (after all existing `describe` blocks):

```typescript
describe('ArchiveConfirmModal', () => {
  it('is hidden by default', () => {
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('shows with correct title and body text', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    modal.show('Delete June 2026?', '5 log entries and 2 todos will be permanently deleted.', vi.fn());
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(true);
    expect(document.getElementById('archiveConfirmTitle')!.textContent).toBe('Delete June 2026?');
    expect(document.getElementById('archiveConfirmBody')!.textContent).toContain('5 log entries');
    modal.hide();
  });

  it('hides when cancel is clicked', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    modal.show('Delete?', 'body', vi.fn());
    document.getElementById('archiveConfirmCancelBtn')!.click();
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('calls onConfirm and hides when delete is clicked', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    const onConfirm = vi.fn();
    modal.show('Delete?', 'body', onConfirm);
    document.getElementById('archiveConfirmDeleteBtn')!.click();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
  });

  it('does not call onConfirm when cancel is clicked', async () => {
    const { ArchiveConfirmModal } = await import('../../components/ArchiveConfirmModal.js');
    const modal = new ArchiveConfirmModal();
    const onConfirm = vi.fn();
    modal.show('Delete?', 'body', onConfirm);
    document.getElementById('archiveConfirmCancelBtn')!.click();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
```

Also add `#archiveConfirmModal` to the existing `FULL_DOM` constant in the same file. Find the `FULL_DOM` string and add this before its closing `</div>`:

```
  <div class="archive-confirm-overlay" id="archiveConfirmModal">
    <div class="archive-confirm-title" id="archiveConfirmTitle"></div>
    <div class="archive-confirm-body" id="archiveConfirmBody"></div>
    <button id="archiveConfirmCancelBtn">Cancel</button>
    <button id="archiveConfirmDeleteBtn">Delete</button>
  </div>
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/__tests__/components/ArchiveModal.test.ts`
Expected: failures — `ArchiveConfirmModal` module not found.

- [ ] **Step 3: Create `src/components/ArchiveConfirmModal.ts`**

```typescript
export class ArchiveConfirmModal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private deleteBtn: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('archiveConfirmModal')!;
    this.titleEl = document.getElementById('archiveConfirmTitle')!;
    this.bodyEl = document.getElementById('archiveConfirmBody')!;
    this.deleteBtn = document.getElementById('archiveConfirmDeleteBtn')!;

    document.getElementById('archiveConfirmCancelBtn')!.addEventListener('click', () => this.hide());
  }

  show(title: string, body: string, onConfirm: () => void): void {
    this.titleEl.textContent = title;
    this.bodyEl.textContent = body;
    this.overlay.classList.add('visible');

    const fresh = this.deleteBtn.cloneNode(true) as HTMLElement;
    this.deleteBtn.replaceWith(fresh);
    this.deleteBtn = fresh;
    this.deleteBtn.addEventListener('click', () => {
      this.hide();
      onConfirm();
    });
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

Run: `pnpm test src/__tests__/components/ArchiveModal.test.ts`
Expected: all `ArchiveConfirmModal` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ArchiveConfirmModal.ts src/__tests__/components/ArchiveModal.test.ts
git commit -m "feat: add ArchiveConfirmModal component"
```

---

## Task 4: Add Clean Icons and Delete Logic to ArchiveModal (TDD)

**Files:**
- Modify: `src/components/ArchiveModal.ts`
- Modify: `src/__tests__/components/ArchiveModal.test.ts`

- [ ] **Step 1: Add clean tests to `ArchiveModal.test.ts`**

First, update the `vi.hoisted` block at the top of the file to also extract `executeMock`:

```typescript
const { queryMock, executeMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue([]),
  executeMock: vi.fn().mockResolvedValue(undefined),
}));
```

Update the `vi.mock('../../db.js', ...)` call to use `executeMock`:

```typescript
vi.mock('../../db.js', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  query: queryMock,
  execute: executeMock,
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));
```

Add a `beforeEach` inside the main `describe('ArchiveModal', ...)` block to reset `executeMock`:

```typescript
beforeEach(() => {
  executeMock.mockClear();
  // ... existing beforeEach contents ...
});
```

Add these tests inside the main `describe('ArchiveModal', ...)` block:

```typescript
it('day tile shows a clean button for non-empty tiles', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('log_entries') && sql.includes('COUNT(*)') && sql.includes('GROUP BY')) {
      return [{ date: '2026-06-03', entry_count: 3 }];
    }
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));
  const cleanBtn = document.querySelector('.archive-day-tile:not(.empty) .archive-clean-btn');
  expect(cleanBtn).not.toBeNull();
});

it('day tile does not show a clean button for empty tiles', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('log_entries') && sql.includes('COUNT(*)') && sql.includes('GROUP BY')) {
      return [{ date: '2026-06-03', entry_count: 3 }];
    }
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));
  const emptyTile = document.querySelector('.archive-day-tile.empty');
  if (emptyTile) {
    expect(emptyTile.querySelector('.archive-clean-btn')).toBeNull();
  }
});

it('clicking day clean button opens confirm dialog with correct title', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 3 }];
    if (sql.includes('COUNT(*)') && sql.includes('log_entries') && sql.includes('date = ?')) return [{ count: 3 }];
    if (sql.includes('COUNT(*)') && sql.includes('todos') && sql.includes('DATE(created_at) = ?')) return [{ count: 1 }];
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  const cleanBtn = document.querySelector<HTMLElement>('.archive-day-tile:not(.empty) .archive-clean-btn');
  expect(cleanBtn).not.toBeNull();
  cleanBtn!.click();
  await new Promise(r => setTimeout(r, 60));

  expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(true);
  expect(document.getElementById('archiveConfirmTitle')!.textContent).toContain('Delete');
  expect(document.getElementById('archiveConfirmBody')!.textContent).toContain('3 log entries');
  expect(document.getElementById('archiveConfirmBody')!.textContent).toContain('1 todos');
});

it('confirming day delete calls execute with correct SQL and reloads', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
    if (sql.includes('COUNT(*)') && sql.includes('log_entries') && sql.includes('date = ?')) return [{ count: 2 }];
    if (sql.includes('COUNT(*)') && sql.includes('todos') && sql.includes('DATE(created_at) = ?')) return [{ count: 0 }];
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  const cleanBtn = document.querySelector<HTMLElement>('.archive-day-tile:not(.empty) .archive-clean-btn');
  cleanBtn!.click();
  await new Promise(r => setTimeout(r, 60));

  document.getElementById('archiveConfirmDeleteBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  expect(executeMock).toHaveBeenCalledWith(
    'DELETE FROM log_entries WHERE date = ?',
    ['2026-06-03']
  );
  expect(executeMock).toHaveBeenCalledWith(
    'DELETE FROM todos WHERE DATE(created_at) = ?',
    ['2026-06-03']
  );
  expect(document.getElementById('archiveConfirmModal')!.classList.contains('visible')).toBe(false);
});

it('week card shows a clean button', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));
  expect(document.querySelector('.archive-week-card .archive-clean-btn')).not.toBeNull();
});

it('confirming week delete calls execute with date range', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
    if (sql.includes('COUNT(*)') && sql.includes('log_entries') && sql.includes('>=')) return [{ count: 2 }];
    if (sql.includes('COUNT(*)') && sql.includes('todos') && sql.includes('>=')) return [{ count: 0 }];
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  const weekClean = document.querySelector<HTMLElement>('.archive-week-card .archive-clean-btn');
  weekClean!.click();
  await new Promise(r => setTimeout(r, 60));

  document.getElementById('archiveConfirmDeleteBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  expect(executeMock).toHaveBeenCalledWith(
    'DELETE FROM log_entries WHERE date >= ? AND date <= ?',
    expect.arrayContaining([expect.any(String), expect.any(String)])
  );
});

it('month divider shows a clean button', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));
  expect(document.querySelector('.archive-month-divider .archive-clean-btn')).not.toBeNull();
});

it('confirming month delete calls execute with LIKE pattern', async () => {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY date')) return [{ date: '2026-06-03', entry_count: 2 }];
    if (sql.includes('COUNT(*)') && sql.includes('LIKE')) return [{ count: 2 }];
    return [];
  });
  document.getElementById('archiveBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  const monthClean = document.querySelector<HTMLElement>('.archive-month-divider .archive-clean-btn');
  monthClean!.click();
  await new Promise(r => setTimeout(r, 60));

  document.getElementById('archiveConfirmDeleteBtn')!.click();
  await new Promise(r => setTimeout(r, 60));

  expect(executeMock).toHaveBeenCalledWith(
    'DELETE FROM log_entries WHERE date LIKE ?',
    ['2026-06-%']
  );
  expect(executeMock).toHaveBeenCalledWith(
    "DELETE FROM todos WHERE DATE(created_at) LIKE ?",
    ['2026-06-%']
  );
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/__tests__/components/ArchiveModal.test.ts`
Expected: failures — `ArchiveModal` constructor doesn't accept `confirmModal`, no clean buttons exist.

- [ ] **Step 3: Update `src/components/ArchiveModal.ts`**

Replace the entire file with the following (this builds on the version from `2026-06-04-archive-navigation.md`, adding clean functionality):

```typescript
import { query, execute } from '../db.js';
import type { ArchiveConfirmModal } from './ArchiveConfirmModal.js';

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

  constructor(
    private onDaySelect: (date: string) => void,
    private confirmModal: ArchiveConfirmModal
  ) {
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
          <button class="archive-clean-btn" title="Delete ${label}">🗑</button>
          <div class="archive-month-line"></div>
        `;
        divider.querySelector('.archive-clean-btn')!.addEventListener('click', () => {
          void this.cleanMonth(monthKey);
        });
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
      ${!isEmpty ? `<button class="archive-clean-btn" title="Delete ${day.date}">🗑</button>` : ''}
    `;

    if (!isEmpty) {
      tile.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('archive-clean-btn')) return;
        this.hide();
        this.onDaySelect(day.date);
      });
      tile.querySelector('.archive-clean-btn')!.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.cleanDay(day.date);
      });
    }
    return tile;
  }

  private async cleanDay(date: string): Promise<void> {
    const [entryRows, todoRows] = await Promise.all([
      query<{ count: number }>('SELECT COUNT(*) as count FROM log_entries WHERE date = ?', [date]),
      query<{ count: number }>('SELECT COUNT(*) as count FROM todos WHERE DATE(created_at) = ?', [date]),
    ]);
    const entryCount = entryRows[0]?.count ?? 0;
    const todoCount = todoRows[0]?.count ?? 0;
    const d = new Date(date + 'T00:00:00');
    const label = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    this.confirmModal.show(
      `Delete ${label}?`,
      `${entryCount} log entries and ${todoCount} todos will be permanently deleted. This cannot be undone.`,
      async () => {
        await Promise.all([
          execute('DELETE FROM log_entries WHERE date = ?', [date]),
          execute('DELETE FROM todos WHERE DATE(created_at) = ?', [date]),
        ]);
        void this.load();
      }
    );
  }

  private async cleanWeek(weekStart: string): Promise<void> {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endDate = end.toISOString().split('T')[0];

    const [entryRows, todoRows] = await Promise.all([
      query<{ count: number }>('SELECT COUNT(*) as count FROM log_entries WHERE date >= ? AND date <= ?', [weekStart, endDate]),
      query<{ count: number }>('SELECT COUNT(*) as count FROM todos WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?', [weekStart, endDate]),
    ]);
    const entryCount = entryRows[0]?.count ?? 0;
    const todoCount = todoRows[0]?.count ?? 0;
    const d = new Date(weekStart + 'T00:00:00');
    const weekLabel = `Week of ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;

    this.confirmModal.show(
      `Delete ${weekLabel}?`,
      `${entryCount} log entries and ${todoCount} todos will be permanently deleted. This cannot be undone.`,
      async () => {
        await Promise.all([
          execute('DELETE FROM log_entries WHERE date >= ? AND date <= ?', [weekStart, endDate]),
          execute('DELETE FROM todos WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?', [weekStart, endDate]),
        ]);
        void this.load();
      }
    );
  }

  private async cleanMonth(yearMonth: string): Promise<void> {
    const [yr, mo] = yearMonth.split('-');
    const pattern = `${yearMonth}-%`;

    const [entryRows, todoRows] = await Promise.all([
      query<{ count: number }>('SELECT COUNT(*) as count FROM log_entries WHERE date LIKE ?', [pattern]),
      query<{ count: number }>('SELECT COUNT(*) as count FROM todos WHERE DATE(created_at) LIKE ?', [pattern]),
    ]);
    const entryCount = entryRows[0]?.count ?? 0;
    const todoCount = todoRows[0]?.count ?? 0;
    const label = new Date(`${yr}-${mo}-01T00:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    this.confirmModal.show(
      `Delete ${label}?`,
      `${entryCount} log entries and ${todoCount} todos will be permanently deleted. This cannot be undone.`,
      async () => {
        await Promise.all([
          execute('DELETE FROM log_entries WHERE date LIKE ?', [pattern]),
          execute('DELETE FROM todos WHERE DATE(created_at) LIKE ?', [pattern]),
        ]);
        void this.load();
      }
    );
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

- [ ] **Step 4: Run tests — confirm they fail (not yet wired into App)**

Run: `pnpm test src/__tests__/components/ArchiveModal.test.ts`
Expected: `ArchiveModal` constructor tests fail — `confirmModal` argument missing from App wiring.

---

## Task 5: Wire ArchiveConfirmModal into App + Fix Test DOMs

**Files:**
- Modify: `src/app.ts`
- Modify: `src/__tests__/components/ChatArea.test.ts`
- Modify: `src/__tests__/components/SettingsModal.test.ts`
- Modify: `src/__tests__/components/TodoPanel.test.ts`

- [ ] **Step 1: Update `src/app.ts`**

Add import after the existing `ArchiveModal` import:

```typescript
import { ArchiveConfirmModal } from './components/ArchiveConfirmModal.js';
```

Add field to the `App` class (after `private archive: ArchiveModal;`):

```typescript
private archiveConfirm: ArchiveConfirmModal;
```

In the `App` constructor, replace:

```typescript
this.archive = new ArchiveModal((date) => { void this.openDayModal(date); });
```

with:

```typescript
this.archiveConfirm = new ArchiveConfirmModal();
this.archive = new ArchiveModal((date) => { void this.openDayModal(date); }, this.archiveConfirm);
```

- [ ] **Step 2: Add confirm DOM to `FULL_DOM` in all three existing test files**

In each of `ChatArea.test.ts`, `SettingsModal.test.ts`, and `TodoPanel.test.ts`, find the `FULL_DOM` constant and add the following immediately before its closing `</div>`:

```
  <div class="archive-confirm-overlay" id="archiveConfirmModal">
    <div class="archive-confirm-title" id="archiveConfirmTitle"></div>
    <div class="archive-confirm-body" id="archiveConfirmBody"></div>
    <button id="archiveConfirmCancelBtn">Cancel</button>
    <button id="archiveConfirmDeleteBtn">Delete</button>
  </div>
```

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts src/components/ArchiveModal.ts \
  src/__tests__/components/ArchiveModal.test.ts \
  src/__tests__/components/ChatArea.test.ts \
  src/__tests__/components/SettingsModal.test.ts \
  src/__tests__/components/TodoPanel.test.ts
git commit -m "feat: add clean actions to ArchiveModal"
```

---

## Task 6: Manual Verification

**Files:** none (dev server only)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Open `http://localhost:1420`.

- [ ] **Step 2: Open archive**

Click "Archive" in the sidebar. Confirm the overlay opens normally.

- [ ] **Step 3: Verify clean icons appear on hover**

Hover over a month divider label — a 🗑 icon should fade in to the right of the label.
Hover over a week card — a 🗑 icon should appear in the stats row.
Hover over a non-empty day tile — a small 🗑 icon should appear in the top-right corner of the tile.
Empty day tiles should show no 🗑 icon.

- [ ] **Step 4: Test day clean flow**

Click the 🗑 on a day tile. Confirm dialog appears with the date in the title and exact entry + todo counts in the body. Click Cancel — dialog closes, nothing deleted, archive still visible. Click 🗑 again, then Delete. Confirm dialog closes, archive reloads (tile disappears or shows "—" if no more entries).

- [ ] **Step 5: Test week clean flow**

Click 🗑 on a week card header. Confirm dialog shows "Delete Week of …?" and correct counts. Confirm. Week card disappears after reload.

- [ ] **Step 6: Test month clean flow**

Click 🗑 on a month divider. Confirm dialog shows "Delete [Month Year]?" with full-month counts. Confirm. All week cards for that month disappear and the month divider is removed.

- [ ] **Step 7: Commit any fixes**

```bash
git add -p
git commit -m "fix: archive clean manual verification fixes"
```
