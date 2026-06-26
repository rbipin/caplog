# React + Markdown Migration — Design

**Date:** 2026-06-26
**Status:** Approved design (pre-implementation)

## Summary

Migrate CapLog's frontend from hand-written Vanilla-TypeScript DOM classes to
**React + TypeScript**, and switch stored content from **HTML to Markdown**,
rendered with **`react-markdown`**. The Rust/Tauri backend, SQLite schema (mostly),
LLM adapters, command parsing, and pure utilities are reused unchanged.

### Goals

All three are weighted equally:

- **Consistency** — one canonical format (Markdown) is stored everywhere. No more
  "HTML in → `stripHtml()` → re-inject" round-trips. Export becomes a near
  passthrough of stored Markdown.
- **Security** — `react-markdown` does not render raw HTML by default, so LLM/user
  content can no longer inject `<script>`/`<img onerror>`. The latent `innerHTML`
  XSS vector is removed without a separate sanitizer step.
- **Portability** — what is in the DB is human-readable Markdown, identical to what
  is exported. Copy/paste, diff, and a future sync all operate on plain text.

### Non-goals (YAGNI — excluded for now)

Optimistic updates, Zustand/Redux, `turndown`, a rich-text editor, real-time sync,
SSR.

## Canonical content format

Markdown is the single stored format in `log_entries.formatted_text` and (rendered
from) `todos.text`.

Format rules:

- **No-AI log** → stored as a single bullet: `- <user text>`.
- **AI log** → stored as the LLM's Markdown bullet list. The model may add **one
  short bold lead-in line** before the bullets for long entries.
- **Todos** → `todos.text` stays plain text but is rendered through the same inline
  Markdown renderer for uniformity (`**bold**`, links, etc.).
- **No raw HTML** is allowed in stored content (we do not enable `rehype-raw`).

### AI system prompt (in `ai.ts`)

Replaces the current "return HTML `<ul><li>`" instruction:

> You reformat the user's raw log text into clean, concise **Markdown** (bullet
> points; you may add one short **bold** lead-in line for long entries). Fix typos,
> capitalize properly, and remove filler. If the input is a long paragraph,
> summarize and rephrase it into well-structured bullets (nested where helpful) that
> remain readable and preserve all key context.
>
> **Stay strictly grounded in the user's text. Never invent, assume, infer, or add
> any detail, fact, name, number, or conclusion that is not explicitly present in
> the input. Only rephrase, condense, and reorganize what is actually there. If
> something is vague, keep it vague rather than guessing.**
>
> Return only Markdown — no preamble, explanation, code fences, or HTML.

A unit test asserts the prompt contains the factual-grounding clause so it cannot be
silently dropped.

## Architecture & directory layout

Only the **repository layer** touches `db.ts` — the seam that makes a future web
move a localized change.

```
src/
  main.tsx                # React entry: mounts <App/> inside providers
  App.tsx                 # 3-column layout + modals
  app/
    providers.tsx         # QueryClientProvider + AppConfigProvider
    AppConfigContext.tsx  # chat_days, adapter status, current date
  data/                   # repository layer — ONLY place calling query()/execute()
    db.ts                 # existing tauri-plugin-sql wrapper (reused as-is)
    logEntriesRepo.ts
    todosRepo.ts
    settingsRepo.ts
  hooks/                  # TanStack Query hooks (useLogEntries, useTodos, ...)
  components/             # React components (.tsx)
    Sidebar / ChatArea / ChatInput / TodoPanel / TodoItem
    LogModal / SettingsModal / ArchiveModal / ArchiveConfirmModal
    Markdown.tsx          # wraps react-markdown + remark-gfm
  markdown/htmlToMarkdown.ts   # one-time migration converter
  llm/                    # reused unchanged
  commands.ts utils.ts archiveUtils.ts logAggregation.ts   # reused
  export.ts               # reused, simplified (Markdown passthrough)
  styles.css              # reused; same class names
```

**Reused untouched:** `db.ts`, `llm/*`, `commands.ts`, `utils.ts` (minus DOM-only
`stripHtml`), `archiveUtils.ts`, `logAggregation.ts`, `types.ts`.

**Layer rules:**

- Components → call hooks, never `query()` directly.
- Hooks → call repositories, wrapped in `useQuery`/`useMutation`.
- Repositories → the only importers of `db.ts`; return typed domain objects.
- `AppConfigContext` holds light app-wide state (chat_days, adapter, current date);
  everything DB-backed lives in TanStack Query.

## Data model, storage & one-time migration

The schema is unchanged. Only the content of `log_entries.formatted_text` changes
from HTML to Markdown. `raw_text` still holds the original input; `todos.text` stays
plain text.

**Write paths (repository layer):**

- **No-AI log** → `formatted_text = "- " + rawText`.
- **AI log** → the LLM's Markdown, post-processed: trim, strip stray code fences,
  collapse leading/trailing blank lines.
- **Edit flow** → rewrites `formatted_text` as `- <newText>`.

**One-time migration of existing HTML rows:**

- Guarded by a new `settings` row `content_format = 'markdown'`. On startup, if the
  flag is absent: read all `log_entries`, convert `formatted_text` HTML→Markdown,
  `UPDATE` each row, then set the flag. Idempotent; runs once.
- Conversion lives in `src/markdown/htmlToMarkdown.ts` — a small, fully unit-tested
  function over the known HTML subset (`<ul><li>`, `<p>`, `<strong>`/`<em>`), e.g.
  `<ul><li>a</li><li>b</li></ul>` → `- a\n- b`, `<p>x</p>` → `x`. It is a throwaway
  converter, deletable once everyone has migrated. No permanent dependency.
- Safety: existing `caplog.db.bak` pattern stays; migration wrapped in try/catch,
  logs failures without blocking startup.

**Export** (`export.ts`) simplifies: emits the stored Markdown for each day directly
(no `stripHtml`, no re-bulleting), with completed todos appended as `- [x] ...`.

## Rendering pipeline

One component renders all content: `components/Markdown.tsx`, wrapping
`react-markdown` + `remark-gfm` (task lists, strikethrough, tables, autolinks).

- **Raw HTML disabled** (no `rehype-raw`) → inert rendering of any injected HTML;
  the security win, with no separate sanitizer to maintain.
- **Two modes:**
  - **Block** (log entries): full Markdown — bullets, nested bullets, optional bold
    lead-in.
  - **Inline** (`todos.text`, completed-todo lines): a thin variant that unwraps the
    outer `<p>` so todos stay on one line.
- **Completed todos keep the ✓ tick mark** in the UI log/day views (rendered as
  `✓ <inline markdown>` with strikethrough). Exported `.md` uses GFM `- [x]` so it
  shows as a checked box in Markdown viewers — same intent, format-appropriate.
- **Link handling for Tauri:** an `a` component override opens external links in the
  system browser (`@tauri-apps/plugin-shell`) instead of navigating the webview.
  For a web future, swap this for default `target="_blank"`.
- **Styling:** `react-markdown` emits the same `<ul>/<li>/<p>/<strong>` elements the
  CSS already targets; `styles.css` mostly carries over.

Used by: ChatArea messages, LogModal day entries, day-detail view, Sidebar previews
(inline, truncated), TodoPanel items. Every surface renders from the same Markdown
source.

## State & data flow (TanStack Query)

**Query keys** (the shared contract):

- `['logEntries','recent', days]` — ChatArea feed + Sidebar window
- `['logEntries','all']` — LogModal + export
- `['logEntries','byDate', date]` — day-detail view
- `['todos']` — TodoPanel + completed-todo lookups
- `['dayStats', days]` — Sidebar counts
- `['settings']` — config

**Repositories** expose plain async functions (the only `db.ts` callers): e.g.
`todosRepo.list()`, `completeTodo(id)`, `reopen(id)`, `setImportant(id, v)`,
`setDeadline(id, d)`; `logEntriesRepo.listRecent(days)`, `listAll()`, `getByDate()`,
`insert()`, `update()`, `remove()`.

**Hooks** wrap them: `useQuery` for reads, `useMutation` for writes. Mutations
invalidate, components auto-refresh:

```ts
const completeTodo = useMutation({
  mutationFn: todosRepo.completeTodo,
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['todos'] });
    qc.invalidateQueries({ queryKey: ['logEntries'] });
    qc.invalidateQueries({ queryKey: ['dayStats'] });
  },
});
```

Completing a todo updates the TodoPanel, ChatArea feed, and Sidebar count
automatically. The hand-wired `setOnComplete`/`setSidebarRefresh`/`setOnChange`
callbacks are deleted.

**AppConfigContext** holds `chatDays`, `adapter` status, `currentDate`, and the
date-rollover interval. Changing `chatDays` (Settings) writes to `settings` and
invalidates `days`-scoped queries.

**Optimistic updates:** deferred (YAGNI) — the local DB is fast enough that
invalidate-then-refetch feels instant.

## Component mapping (Vanilla → React)

| Today | React | Notes |
|---|---|---|
| `app.ts` `App` | `App.tsx` + `app/providers.tsx` + `AppConfigContext` | Layout + providers; callback wiring gone |
| `InputHandler` | `ChatInput.tsx` | Controlled textarea; `parseCommand` reused |
| `ChatArea` | `ChatArea.tsx` | Collapsible day sections, focus-today, edit-in-place; renders via `<Markdown>` |
| `TodoPanel` | `TodoPanel.tsx` + `TodoItem.tsx` | Sections (Important → Due/Overdue → Open → Completed); inline chips |
| `Sidebar` | `Sidebar.tsx` | Day list + counts from `useDayStats`; inline Markdown previews |
| `LogModal` | `LogModal.tsx` | Month + day-detail; consumes `buildDayLogs`; ✓ completed todos |
| `SettingsModal` | `SettingsModal.tsx` | Provider/key/model/chat_days; save → mutation + invalidation |
| `ArchiveModal` | `ArchiveModal.tsx` | Year calendar via `buildWeeks`, search, day-select |
| `ArchiveConfirmModal` | `ArchiveConfirmModal.tsx` | Confirm-delete dialog |
| — | `Markdown.tsx` | New shared renderer |

**Preserved behaviors:** collapsible/auto-expand-today feed, edit-in-place, todo
inline chip editing, archive search + year nav, export button, AI status pill,
sidebar toggle, 60s date-rollover.

## Tooling & dependencies

**Add (runtime):** `react`, `react-dom`, `@tanstack/react-query`, `react-markdown`,
`remark-gfm`, `@tauri-apps/plugin-shell` (if not already present).

**Add (dev):** `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`,
`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.

**Config changes:**

- `vite.config.ts` — add `react()` plugin; keep `strictPort: true` on 1420.
- `tsconfig.json` — `"jsx": "react-jsx"`, ensure `DOM` lib, `moduleResolution: "bundler"`.
- `index.html` — replace `app.ts` entry with `<div id="root">` + `main.tsx` script.
- `package.json` scripts unchanged (`dev`, `build`, `test`, `tauri dev/build`).
- Vitest stays on `happy-dom`; add `setupTests.ts` importing `@testing-library/jest-dom`.

**Convention shift:** new `.tsx` imports follow bundler resolution (no `.js` suffix);
reused modules keep their existing `.js` suffixes. Documented in `CLAUDE.md`.

**Backend:** no Rust changes; `tauri-plugin-sql` and migrations untouched.

## Testing strategy

Stays on Vitest + happy-dom; add React Testing Library. A shared
`renderWithProviders()` wraps components in a fresh `QueryClient` per test plus
`AppConfigProvider`.

**Reused largely as-is:** `commands.test`, `todoLogic.test`, `archiveUtils.test`,
`logAggregation.test`, `db.test`, `llm/*`.

- `utils.test` — drop `stripHtml` cases (removed); keep the rest.
- `export.test` — update for Markdown passthrough; completed todos still `- [x]`.
- `ai.test` — update for the Markdown prompt; add assertion that `SYSTEM_PROMPT`
  contains the factual-grounding clause.

**Rewritten as RTL component tests** (same behaviors, new mechanics): `ChatArea`,
`TodoPanel`/`TodoItem`, `Sidebar`, `LogModal`, `SettingsModal`, `ArchiveModal`,
`DayLogModal`. Repository modules mocked at the boundary.

**New tests:**

- `htmlToMarkdown.test` — `<ul><li>`/`<p>`/`<strong>` conversions.
- Migration test — startup converts HTML rows and sets `content_format=markdown`;
  idempotent on re-run.
- `Markdown.test` — security: `<script>`/`<img onerror>` renders inert.
- Repository tests — mock `db.ts`, assert SQL/params.

**Bar:** behavior parity with today plus the new security and grounding guarantees.
Cross-component refresh verified via mutation→invalidation tests.

## Phased rollout

- **Phase 0 — Tooling:** add deps; wire `@vitejs/plugin-react`, JSX tsconfig,
  `index.html` root + `main.tsx`; set up RTL + `renderWithProviders`.
- **Phase 1 — Data layer:** `data/*Repo.ts`, Query hooks, `AppConfigContext`,
  providers. Repo/hook tests. No UI yet.
- **Phase 2 — Markdown core:** `Markdown.tsx`, `htmlToMarkdown.ts` + startup
  migration + `content_format` flag, AI prompt rewrite. Security + migration +
  grounding tests.
- **Phase 3 — Components:** port Sidebar, ChatInput/ChatArea, TodoPanel/TodoItem,
  LogModal, SettingsModal, ArchiveModal(+Confirm), `App.tsx` layout. RTL tests.
- **Phase 4 — Cutover & cleanup:** switch entry to `main.tsx`, delete old vanilla
  classes + obsolete tests, simplify `export.ts`, update `README`/`CLAUDE.md`, full
  suite + `pnpm tauri dev` smoke + Windows build check.

## Risks & mitigations

- **Scope / regressions in nuanced interactions** (edit-in-place, inline chips,
  collapsible sections) → parity-focused RTL tests; `sample/caplog-mock.html` as the
  behavior reference.
- **Old-data conversion edge cases** → unit-tested converter, DB backup, idempotent
  flag, non-blocking try/catch.
- **LLM returns HTML/code fences** → prompt + post-processing strip, with tests.
- **Import-convention shift** (`.js` suffix) → documented in `CLAUDE.md`.

## Web-future seam

`data/*Repo.ts` is the only `db.ts` caller. Going web = reimplement those repos
against `fetch`, swap the Markdown link override to `target="_blank"`, drop Tauri
plugins. Hooks, query keys, components, and Markdown rendering stay identical.
