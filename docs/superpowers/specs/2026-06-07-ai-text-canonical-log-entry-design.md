# AI Text as Canonical Log Entry

**Date:** 2026-06-07

## Problem

When AI summarization is configured, the app stores both the user's raw input (`raw_text`) and the AI-formatted HTML bullets (`formatted_text`). The chat area already shows the AI output as the primary content, but the sidebar preview and archive search still read from `raw_text`, so they show the user's unformatted original input. The edit textarea also pre-fills from `raw_text`, which is inconsistent with the AI output being the displayed version.

## Goal

When AI is available, the AI-formatted text is the canonical log entry everywhere except the chat area's "Original input" label (which keeps the raw input for reference). When AI is not configured, behavior is unchanged since `raw_text === formatted_text`.

## Design

### What changes

| Surface | Currently reads | After |
|---|---|---|
| Sidebar preview | `raw_text` (SQL subquery) | `formatted_text` → `stripHtml()` |
| Archive search | `raw_text LIKE ?` | `formatted_text LIKE ?` |
| Chat area display | `formatted_text` (main) + `raw_text` (original label) | unchanged |
| Edit textarea pre-fill | `raw_text` | `stripHtml(formatted_text)` when AI was used |
| Export / stats | `formatted_text` already | unchanged |

### What does not change

- DB schema: no migrations, `raw_text` and `formatted_text` columns stay as-is
- `raw_text` continues to store the user's original input as a silent audit trail
- Chat area "Original input" label continues to show `raw_text` when it differs from `formatted_text`
- No-AI path: `raw_text === formatted_text`, so all surfaces behave identically to today

### No-AI fallback

When `llm_provider` is not configured, `handleLog` in `app.ts` sets both fields to the same escaped HTML: `<ul><li>escaped raw text</li></ul>`. Because `raw_text === formatted_text`, the sidebar preview and archive search produce the same results as before. No special-casing needed.

## Implementation

Three targeted edits, all in existing files. No new abstractions.

### 1. `src/components/Sidebar.ts`

Change the preview SQL subquery from `raw_text` to `formatted_text`. Call `stripHtml()` (already exported from `src/utils.ts`) on the result before inserting it into the DOM.

### 2. `src/components/ArchiveModal.ts` (line ~254)

Change `raw_text LIKE ?` to `formatted_text LIKE ?` in the keyword search query.

### 3. `src/app.ts` (line ~122)

When loading entries from DB into ChatArea, `rawInput` is currently set to `e.raw_text` when it differs from `formatted_text`. Change this so `rawInput` is set to `stripHtml(e.formatted_text)` in that case, so the edit textarea pre-fills with the clean AI text rather than the original messy input.

## Testing

- Existing unit tests mock `formatLogEntry` and assert on stored values — no changes needed.
- Sidebar and ArchiveModal component tests that assert on preview/search text content may need fixture data updated to use `formatted_text` values.
- No new tests required; the change is a read-path swap with no new logic.
