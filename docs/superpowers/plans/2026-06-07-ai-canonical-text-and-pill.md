# AI Canonical Text + Status Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-formatted text the canonical log entry across sidebar, archive search, and edit pre-fill; add a static AI status pill to the header.

**Architecture:** No DB schema changes. All changes are read-path swaps (`raw_text` → `formatted_text`) in existing components, plus a new `updateAiPill()` method in `App` that reflects `this.adapter` state into a new header element.

**Tech Stack:** TypeScript, Vite, Vitest, happy-dom, SQLite (via Tauri plugin)

---

## File Map

| File | Change |
| --- | --- |
| `src/components/Sidebar.ts` | Import `stripHtml`; change SQL subquery field to `formatted_text`; strip HTML on preview |
| `src/components/ArchiveModal.ts` | Change search query from `raw_text LIKE ?` to `formatted_text LIKE ?` |
| `src/app.ts` | Change `rawInput` assignment to use `stripHtml(e.formatted_text)`; add `updateAiPill()`; call it after init and after settings save |
| `index.html` | Add `<span id="aiStatusPill">` between logo and date |
| `src/styles.css` | Add `.pill`, `.pill-green`, `.pill-yellow`, `.pill-dot` styles |
| `src/__tests__/components/Sidebar.test.ts` | Add test: preview renders stripped `formatted_text` |
| `src/__tests__/components/ChatArea.test.ts` | Add `aiStatusPill` to FULL_DOM; add pill state tests |

---

### Task 1: Sidebar preview reads `formatted_text`

**Files:**
- Modify: `src/components/Sidebar.ts`
- Modify: `src/__tests__/components/Sidebar.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/components/Sidebar.test.ts` inside `describe('Sidebar', ...)`:

```typescript
it('renders preview as plain text stripped from formatted_text HTML', async () => {
  queryMock.mockResolvedValue([{
    date: '2026-06-01',
    log_count: 1,
    todo_done_count: 0,
    preview: '<ul><li>Meeting notes</li></ul>',
  }]);
  const sidebar = new Sidebar(vi.fn());
  await sidebar.refresh(3);

  const preview = document.querySelector('.day-entry-preview');
  expect(preview).not.toBeNull();
  expect(preview!.textContent).toBe('Meeting notes');
  expect(preview!.textContent).not.toContain('<');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/components/Sidebar.test.ts
```

Expected: FAIL — preview renders raw HTML tags instead of stripped text.

- [ ] **Step 3: Update `src/components/Sidebar.ts`**

Change the import line at the top:

```typescript
import { escapeHtml, parseLocalDate, stripHtml } from '../utils.js';
```

Change the SQL subquery field from `raw_text` to `formatted_text`:

```typescript
private async load(): Promise<void> {
  const stats = await query<DayStats>(`
    SELECT
      l.date,
      COUNT(l.id) AS log_count,
      (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
      (SELECT formatted_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
    FROM log_entries l
    GROUP BY l.date
    ORDER BY l.date DESC
    LIMIT ?
  `, [this.days]);
```

Change the preview rendering line inside `renderEntry`:

```typescript
<div class="day-entry-preview">${escapeHtml(stripHtml(s.preview ?? ''))}</div>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/__tests__/components/Sidebar.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.ts src/__tests__/components/Sidebar.test.ts
git commit -m "feat: sidebar preview reads formatted_text instead of raw_text"
```

---

### Task 2: Archive search queries `formatted_text`

**Files:**
- Modify: `src/components/ArchiveModal.ts`

- [ ] **Step 1: Locate the search query**

The line to change is in `applySearch()` in `src/components/ArchiveModal.ts`:

```typescript
'SELECT DISTINCT date FROM log_entries WHERE date LIKE ? AND raw_text LIKE ?',
```

- [ ] **Step 2: Change `raw_text` to `formatted_text` in the search query**

```typescript
const matchingRows = await query<{ date: string }>(
  'SELECT DISTINCT date FROM log_entries WHERE date LIKE ? AND formatted_text LIKE ?',
  [`${this.currentYear}-%`, `%${q}%`]
);
```

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS. (No test currently asserts on which field is searched; this is a safe change.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ArchiveModal.ts
git commit -m "feat: archive search queries formatted_text instead of raw_text"
```

---

### Task 3: Edit pre-fill uses AI-cleaned text

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Locate the `rawInput` assignment in `loadRecentEntries`**

In `src/app.ts`, find this block (around line 120):

```typescript
this.chatArea.append({
  time, type: 'log', typeLabel: 'Log entry',
  content: e.formatted_text,
  rawInput: e.raw_text !== e.formatted_text ? e.raw_text : undefined,
  entryId: e.id,
}, false);
```

- [ ] **Step 2: Change `rawInput` to use `stripHtml(e.formatted_text)`**

```typescript
this.chatArea.append({
  time, type: 'log', typeLabel: 'Log entry',
  content: e.formatted_text,
  rawInput: e.raw_text !== e.formatted_text ? stripHtml(e.formatted_text) : undefined,
  entryId: e.id,
}, false);
```

`stripHtml` is already imported at line 5 of `src/app.ts` — no import change needed.

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts
git commit -m "feat: edit pre-fill uses AI-cleaned text instead of raw input"
```

---

### Task 4: AI status pill — HTML and styles

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

- [ ] **Step 1: Add the pill element to `index.html`**

Find the header section:

```html
<header class="header">
  ...
  <div class="header-logo">CapLog</div>
  <div class="header-date" id="headerDate"></div>
```

Add the pill span between the logo and the date:

```html
<header class="header">
  ...
  <div class="header-logo">CapLog</div>
  <span id="aiStatusPill" class="pill pill-yellow"><span class="pill-icon">⚠</span>No AI</span>
  <div class="header-date" id="headerDate"></div>
```

The pill defaults to the inactive state; `App` will update it once `getAdapter()` resolves.

- [ ] **Step 2: Add pill styles to `src/styles.css`**

Add after the `.btn-ghost.active` block (after line ~102):

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  user-select: none;
}
.pill-green {
  background: #0d2e1a;
  border: 1px solid #1a5c32;
  color: #4ade80;
}
.pill-yellow {
  background: #2a1f00;
  border: 1px solid #5c4200;
  color: #fbbf24;
}
.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 4px #4ade80;
  flex-shrink: 0;
}
.pill-icon {
  font-size: 10px;
}
```

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS (HTML/CSS changes don't affect logic tests).

- [ ] **Step 4: Commit**

```bash
git add index.html src/styles.css
git commit -m "feat: add AI status pill element and styles to header"
```

---

### Task 5: Wire pill state in `App`

**Files:**
- Modify: `src/app.ts`
- Modify: `src/__tests__/components/ChatArea.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/__tests__/components/ChatArea.test.ts`:

1. Add `<span id="aiStatusPill" class="pill pill-yellow"></span>` to `FULL_DOM` between `header-logo` and `headerDate`. Find this line:

```typescript
  <div id="headerDate"></div>
```

Replace with:

```typescript
  <span id="aiStatusPill" class="pill pill-yellow"></span>
  <div id="headerDate"></div>
```

2. Add a new `describe` block at the end of the file (after the existing `describe` closes). The existing mock has `getAdapter` returning `null` — use that for the inactive test, and a separate `describe` with its own `beforeAll` for the active test:

```typescript
describe('AI status pill', () => {
  beforeEach(() => {
    document.body.innerHTML = FULL_DOM;
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
  });

  it('shows pill-yellow and "No AI" when adapter is null', async () => {
    // getAdapter already mocked to return null at the top of this file
    await import('../../app.js');
    await new Promise(r => setTimeout(r, 50));

    const pill = document.getElementById('aiStatusPill')!;
    expect(pill.classList.contains('pill-yellow')).toBe(true);
    expect(pill.classList.contains('pill-green')).toBe(false);
    expect(pill.textContent).toContain('No AI');
  });

  it('shows pill-green and "AI Active" when adapter is non-null', async () => {
    const { getAdapter } = await import('../../llm/factory.js');
    vi.mocked(getAdapter).mockResolvedValue({ complete: vi.fn().mockResolvedValue('') });

    await import('../../app.js');
    await new Promise(r => setTimeout(r, 50));

    const pill = document.getElementById('aiStatusPill')!;
    expect(pill.classList.contains('pill-green')).toBe(true);
    expect(pill.classList.contains('pill-yellow')).toBe(false);
    expect(pill.textContent).toContain('AI Active');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/__tests__/components/ChatArea.test.ts
```

Expected: FAIL — `updateAiPill` does not exist yet, pill stays in its default HTML state regardless of adapter.

- [ ] **Step 3: Add `updateAiPill()` to `src/app.ts`**

Add this private method to the `App` class (after `refreshAdapter()`):

```typescript
private updateAiPill(): void {
  const pill = document.getElementById('aiStatusPill');
  if (!pill) return;
  if (this.adapter) {
    pill.className = 'pill pill-green';
    pill.innerHTML = '<span class="pill-dot"></span>AI Active';
  } else {
    pill.className = 'pill pill-yellow';
    pill.innerHTML = '<span class="pill-icon">⚠</span>No AI';
  }
}
```

- [ ] **Step 4: Call `updateAiPill()` after adapter is set**

In `init()`, add the call after `this.adapter = await getAdapter()`:

```typescript
this.adapter = await getAdapter();
this.updateAiPill();
```

In `refreshAdapter()`, add the call after `this.adapter = await getAdapter()`:

```typescript
private async refreshAdapter(): Promise<void> {
  this.adapter = await getAdapter();
  this.updateAiPill();
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test src/__tests__/components/ChatArea.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app.ts src/__tests__/components/ChatArea.test.ts
git commit -m "feat: wire AI status pill to adapter state in App"
```
