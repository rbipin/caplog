# Archive Navigation — Design Spec

**Date:** 2026-06-04
**Status:** Pending

## Problem

The sidebar currently loads the last 30 days as a flat list. As CapLog accumulates months and years of daily entries (5–20 per day), this list becomes unusable. Users need a way to browse and search historical entries without cluttering the main sidebar.

## Decision

The sidebar remains unchanged for recent days. Historical navigation lives in a separate **Archive** full-screen overlay, opened via an "Archive" button added to the sidebar.

## User Mental Model

Users think in **weekly chunks** ("what did I do last week?") and need both **browsing by date** and **searching by content** equally.

## Design

### Trigger

An `Archive` button styled as `.btn-ghost` is added to the sidebar header, between the section title and the day list. Clicking it opens the archive overlay.

### Archive Overlay

A full-screen overlay (`position: fixed; inset: 0`) that replaces the entire app view while open. Follows existing modal patterns (same close button style, same color tokens).

**Header bar** (48px, matches app header height):

- *Archive* title — `font-serif`, italic, `var(--accent)` color
- Search input — full-width, `var(--bg)` background, focuses to `var(--accent)` border; searches across `raw_text` and `formatted_text` of all entries
- Year navigator — `◀ YYYY` · `YYYY (active)` · `YYYY ▶` buttons, styled as `.btn-ghost`; future years are disabled/dimmed
- Close button — `✕`, 28×28px, red on hover (matches `.modal-close`)

**Body** (scrollable, `padding: 24px 32px`):

Content is ordered newest-first. Month boundaries are marked with a centered divider line + label (same pattern as `.day-divider`, uppercase, `var(--text-dim)`).

Each **week card** (`background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 6px`) contains:

- **Week header**: "Week of Mon DD" label (uppercase, `var(--text-muted)`) + entry count tag (`.tag-log`) + todo-done count tag (`.tag-todo`)
- **Day tiles**: horizontal row of day tiles, one per calendar day Mon–Fri (weekends shown only if they have entries)

Each **day tile** (`background: var(--surface-2)`, `border-radius: 4px`, left border accent on hover/active):

- Day-of-week abbreviation (`var(--text-dim)`, 10px)
- Day number (Instrument Serif, 22px, `var(--text)`)
- Entry count (`var(--text-dim)`, 10px) — shown as `—` if no entries
- Empty days (no entries): dimmed to 30% opacity, not clickable
- Today's tile: amber left border + `var(--accent-dim)` background, amber text

**Interaction:** Clicking a day tile closes the archive and loads that day's entries in the main chat area (same as clicking a day in the sidebar).

### Search Behavior

Typing in the search field filters the view in real time:

- Matching weeks remain visible; non-matching weeks collapse
- Days with matching entries are highlighted (amber left border); days with no matches are dimmed
- Search triggers a DB query against `raw_text` of `log_entries` for the selected year (debounced ~200ms); results return matching dates which highlight the relevant day tiles
- Empty search state shows all weeks

### No Quarters

Quarter grouping (Q1/Q2/Q3/Q4) is intentionally omitted. The week-card layout with month dividers provides sufficient orientation without adding an extra navigation level.

## Data

No schema changes required. All queries use the existing `log_entries` table:

```sql
-- Load all entry dates + counts for a given year
SELECT date, COUNT(*) as entry_count
FROM log_entries
WHERE date LIKE '2026-%'
GROUP BY date
ORDER BY date DESC

-- Load todo-done counts per date
SELECT DATE(completed_at) as date, COUNT(*) as done_count
FROM todos
WHERE completed_at LIKE '2026-%'
GROUP BY DATE(completed_at)
```

These are joined in-memory on the frontend to build the week/day structure.

## New Component

`src/components/ArchiveModal.ts` — `ArchiveModal` class, following the pattern of `LogModal` and `SettingsModal`:

- Constructor accepts `onDaySelect: (date: string) => void` callback
- `show()` / `hide()` methods
- Manages its own DOM overlay element
- Wired into `App` class alongside existing modals

## CSS

New styles added to `src/styles.css` under a clearly marked `/* ── Archive modal ── */` section. Reuses existing tokens and patterns — no new CSS variables needed.

## Sidebar Change

The sidebar header gains an "Archive" button (`.btn-ghost`) that calls `archiveModal.show()`. The existing month label and day list are unchanged.

## Out of Scope

- Editing or deleting entries from the archive view
- Exporting from the archive (that lives in `LogModal`)
- Week summary / AI-generated recap
- Pagination (the year navigator + in-memory grouping handles scale)
