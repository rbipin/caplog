# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the full Tauri desktop app (starts Vite dev server + Rust backend)
pnpm tauri dev

# Frontend only (Vite on port 1420)
pnpm dev

# Type-check + build frontend
pnpm build

# Run tests (Vitest)
pnpm test

# Watch mode tests
pnpm test:watch

# Build the distributable Tauri app
pnpm tauri build

# Windows: automated build with prerequisite checks + MSVC env setup
./scripts/build-windows.ps1
```

## Architecture

CapLog is a **Tauri v2** desktop app: a Vite + **React + TypeScript** frontend talking to a Rust backend via Tauri's IPC (`invoke`). Server state is managed with **TanStack Query**. Log content is stored as **Markdown** and rendered with **react-markdown** (raw HTML disabled). The UI has three columns: Sidebar (past days), ChatArea (log feed + input), TodoPanel (task list).

### Frontend (`src/`)

`src/main.tsx` is the entry point: it runs `initDB()`, `runLLMMigration()`, `runContentMigration()`, then renders `<Providers><App/></Providers>` into `#root`. `src/app/App.tsx` is the root orchestrator — it owns layout, header, modal open-state, ephemeral notices, and the submit handler.

Architecture rule: **components → hooks → repos → db**. Only `data/*Repo.ts` may import `db.ts`. Components read/write through TanStack Query hooks in `src/hooks/`.

| Area | Responsibility |
|------|----------------|
| `src/main.tsx` | Bootstrap: DB init, migrations, React render, window show |
| `src/app/App.tsx` | Root layout + header; owns modal state, `Notice[]` state, and `handleSubmit` (parseCommand → mutations; ephemeral notices for `/done` and AI failures) |
| `src/app/providers.tsx` | `QueryClient` (invalidate-driven: `staleTime: Infinity`, `retry: false`) + `AppConfigProvider` |
| `src/app/AppConfigContext.tsx` | `useAppConfig()` → `chatDays`, `setChatDays`, `adapter`, `refreshAdapter`, `currentDate` (60s rollover invalidates day-scoped queries) |
| `src/components/ChatInput.tsx` | Textarea; detects command prefix, fires `onSubmit` |
| `src/components/ChatArea.tsx` | Central chat feed via `buildFeed`; today's section open at top, past days collapsible. Renders Markdown; `LogMessage` supports inline edit/delete. Accepts `notices` (today-only system messages) |
| `src/components/TodoPanel.tsx` / `TodoItem.tsx` | Right-panel todo list; sections Important → Due/Overdue → Open → Completed. `TodoItem` has inline text/meta editing, importance + deadline chips, complete/reopen/delete |
| `src/components/Sidebar.tsx` | Left panel; past days via `useDayStats(chatDays)`; click opens that day's log |
| `src/components/LogModal.tsx` | Overlay: `day === null` → month view (all entries + completed todos via `buildDayLogs`); a date → single-day view. Footer Export .md |
| `src/components/SettingsModal.tsx` | LLM provider/key/model/baseUrl/chat_days; save → `settingsRepo` + `refreshAdapter` + `setChatDays` |
| `src/components/ArchiveModal.tsx` / `ArchiveConfirmModal.tsx` | Year calendar via `useArchiveYear` + `buildWeeks`; keyword search via `useArchiveSearch`; clean ranges via `useDeleteArchiveRange` behind a confirm dialog |
| `src/components/Markdown.tsx` | Shared react-markdown renderer (remark-gfm; raw HTML disabled for safety). `inline`/block modes; links open via `tauri-plugin-opener` |

**Data layer** lives in `src/data/`: `logEntriesRepo`, `todosRepo`, `settingsRepo`, `archiveRepo` — the only modules that import `db.ts`. **Query hooks** in `src/hooks/` wrap them (`useLogEntries`, `useTodos`, `useDayStats`, `useArchive`, plus `queryKeys.ts`). Mutations invalidate `['logEntries']`, `['todos']`, and `['dayStats']` as appropriate.

**Markdown** lives in `src/markdown/`: `htmlToMarkdown.ts` (legacy HTML→Markdown converter) and `contentMigration.ts` (`runContentMigration()` — one-time startup migration guarded by the `content_format=markdown` setting).

**Feed building** lives in `src/feed.ts`: `buildFeed(entries, todos, today)` → `FeedDay[]` — pure builder for the chat feed.

**Archive utilities** live in `src/archiveUtils.ts`: exports `DayData`, `WeekData`, `getWeekStart()`, and `buildWeeks()` — aggregate DB rows into week buckets for the `ArchiveModal`.

**Log aggregation** lives in `src/logAggregation.ts`: exports `DayLog` and `buildDayLogs(entries, completedTodos)` — groups log entries and completed todos into per-day buckets (sorted date-descending, todo-only days included). `item.text` is the raw Markdown (passed through, not stripped). Shared by `LogModal` (View Log) and `exportMarkdown()`. A todo's day is keyed off `completed_at`.

**Command parsing** is handled in `src/commands.ts` via `parseCommand()`. Plain text → `log`. Slash commands: `/todo`, `/done`, `/important`, `/by`.

**LLM layer** lives in `src/llm/`:
- `adapter.ts` — `LLMAdapter` interface (`formatEntry(text): Promise<string>`)
- `factory.ts` — `getAdapter()` reads settings from DB, returns the right adapter or `null`
- `anthropic.ts` — Anthropic adapter (default model: `claude-haiku-4-5-20251001`)
- `openai.ts` — OpenAI-compatible adapter (requires `llm_base_url`)

**Styles and fonts** are in `src/styles.css`. Fonts: Instrument Serif (headings) + DM Mono (body). Dark theme via CSS custom properties (`--bg`, `--surface`, `--text`, etc.).

### Backend (`src-tauri/src/`)

- `lib.rs` — Tauri app setup; all commands registered via `invoke_handler`
- `main.rs` — entry point that calls `lib::run()`

SQLite migrations run automatically at startup from `src-tauri/migrations/`. Tables: `log_entries`, `todos`, `settings`.

### Scripts (`scripts/`)

Helper scripts that aren't part of the app runtime.

| File | Purpose |
|------|---------|
| `scripts/build-windows.ps1` | Automated Windows build. Checks Rust/Node/pnpm, locates a Visual Studio install with the full Desktop x64 MSVC + Windows SDK (skipping OneCore-only installs), loads `vcvars64.bat` into the current PowerShell process, then runs `pnpm install` (if needed) and `pnpm tauri build`. Flags: `-InstallMissing` (auto-install missing tools via winget), `-ForceInstall` (always run `pnpm install`), `-SkipBuild` (env check only). See the "Windows build FAQ" in README.md for the issues this script addresses (vcvars not loaded, `LNK1104: msvcrt.lib` from partial VS installs, Tauri JS/Rust version mismatch). |

### Design reference

`sample/caplog-mock.html` is the canonical UI reference — a self-contained file with working JS, dark theme, and all three-column layout. Match it for visual design and interactions when building features.

## Testing

Tests live in `src/__tests__/`. Run with `pnpm test`.

- Component tests (`__tests__/components/`) use React Testing Library + `renderWithProviders` (from `__tests__/testUtils.tsx`), which wraps the component in a fresh `QueryClient` + `AppConfigProvider`. They mock at the repo boundary (`vi.mock('../../data/...Repo')`) and the LLM factory.
- Repo/hook tests mock `../db.js` or the repo module directly.
- Pure-logic unit tests exist for `commands`, `todoLogic`, `utils`, `ai`, `db`, `export`, `feed`, `logAggregation`, `markdown/`, and `llm/`.
- Test environment: Vitest + happy-dom + Testing Library. Tauri plugins are mocked in `src/__mocks__/tauri-plugins.ts`; `src/setupTests.ts` is the global setup.

## Key conventions

- Frontend IPC calls use `@tauri-apps/api` (`invoke`), not `withGlobalTauri`
- New Rust commands must be registered in `tauri::generate_handler![]` in `lib.rs`
- The Tauri dev server expects port 1420 (`strictPort: true` in `vite.config.ts`)
- Package manager: **pnpm**
- **Import convention**: new React-era modules (`app/`, `components/*.tsx`, `data/`, `hooks/`, `markdown/`, `feed.ts`) import each other **without** a file extension (bundler resolution). Reused pre-existing modules (`db`, `utils`, `types`, `commands`, `ai`, `export`, `logAggregation`, `archiveUtils`, `llm/*`) are still imported **with** the `.js` suffix.
- **Architecture rule**: components call hooks, hooks call repos, only `data/*Repo.ts` import `db.ts`. Never import `tauri-plugin-sql` or `db.ts` directly in components.
- Log content is **Markdown**. A no-AI log entry is stored as `- <text>`; AI entries store the LLM's post-processed Markdown. Render only through `components/Markdown.tsx` (raw HTML is intentionally disabled).
- The `tauri` Rust crate and `@tauri-apps/api` / `@tauri-apps/cli` npm packages must share the same `major.minor`. If you bump one, bump the others (`pnpm update @tauri-apps/api @tauri-apps/cli`).
- On Windows, `pnpm tauri build` fails with `LNK1104: msvcrt.lib` unless the MSVC env vars are loaded. Use `scripts/build-windows.ps1` or run from "x64 Native Tools Command Prompt for VS 2022". Partial VS installs that only ship the OneCore CRT subset will not work — the full "Desktop development with C++" workload is required.
