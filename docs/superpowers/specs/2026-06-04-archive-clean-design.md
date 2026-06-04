# Archive Clean — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Problem

The archive view lets users browse historical entries but provides no way to remove old data. Users need a way to permanently delete log entries and todos for a given day, week, or month from within the archive.

## Decision

Add inline trash icons that appear on hover at three levels of the archive view (month, week, day), each triggering a confirmation dialog before permanently deleting all log entries and todos for that period.

## UI Placement

A trash icon (`🗑`) appears on hover at three levels:

- **Month divider** — icon appears to the right of the month label (e.g., "JUNE 2026 🗑"). Deletes all entries + todos for that calendar month.
- **Week card header** — icon appears next to the week's stats tags (e.g., "5 entries · 2 done 🗑"). Deletes the Mon–Sun span of that week.
- **Day tile** — small icon overlaid in the top-right corner on hover. Deletes that single day.

All icons are hidden (`opacity: 0`) by default and fade in on parent hover. Empty day tiles show no icon — nothing to delete.

## Confirmation Dialog

An inline confirmation modal (not `window.confirm`) appears centered over the archive overlay, using existing color tokens. It contains:

- **Title:** "Delete [period]?" — e.g., "Delete June 2026?", "Delete Week of Jun 2?", "Delete Jun 3?"
- **Body:** "[N] log entries and [M] todos will be permanently deleted. This cannot be undone."
- **Two buttons:** "Cancel" (`.btn-ghost`) and "Delete" (`.btn-danger` — red background, white text)

Counts shown in the dialog are fetched from the DB before the dialog opens (reusing the archive's existing count queries), so the user sees exactly what will be deleted.

## Data Layer

Three new Rust commands in `src-tauri/src/lib.rs`:

| Command | Scope | Tables affected |
|---------|-------|-----------------|
| `delete_day(date: String)` | Single calendar day | `log_entries WHERE date = ?` and `todos WHERE DATE(created_at) = ?` |
| `delete_week(week_start: String)` | Mon–Sun (7 days) | Both tables, date range `[week_start, week_start + 6 days]` |
| `delete_month(year: i32, month: i32)` | Full calendar month | Both tables, `date LIKE 'YYYY-MM-%'` |

Todos are scoped by `DATE(created_at)` — cleaning a period removes todos *created* in that period, regardless of completion status.

On the frontend, `ArchiveModal` calls `invoke('delete_day' | 'delete_week' | 'delete_month', {...})`, then reloads the archive body for the current year.

No schema changes required.

## CSS

New styles added under the existing `/* ── Archive modal ── */` section in `src/styles.css`:

- `.archive-clean-btn` — the trash icon button; `opacity: 0`, transitions to `opacity: 1` on parent hover, red on its own hover
- `.btn-danger` — red background (`#c0392b`), white text, for the confirmation dialog delete button
- `.archive-confirm-overlay` — confirmation dialog backdrop + centered card

## New Component

`src/components/ArchiveConfirmModal.ts` — a small `ArchiveConfirmModal` class:

- `show(title, body, onConfirm)` — renders and displays the dialog
- `hide()` — dismisses the dialog
- Manages its own DOM element, injected into `index.html`

`ArchiveModal` holds a reference to `ArchiveConfirmModal` and calls it when a clean icon is clicked.

## Out of Scope

- Soft delete / undo
- Selective entry deletion (individual entries within a day)
- Cleaning todos by completion date (scope is creation date only)
