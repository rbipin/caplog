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

CapLog is a **Tauri v2** desktop app: a Vite + Vanilla TypeScript frontend talking to a Rust backend via Tauri's IPC (`invoke`). The UI has three columns: Sidebar (past days), ChatArea (log feed + input), TodoPanel (task list).

### Frontend (`src/`)

Each UI class lives in its own file under `src/components/`. `src/app.ts` is the entry point — it instantiates all components and wires them together in the `App` class.

| File | Class | Responsibility |
|------|-------|----------------|
| `src/app.ts` | `App` | Root orchestrator; wires all components, registers DOMContentLoaded. `applyChatDays()` reads `chat_days` from DB and pushes the value into `Sidebar.refresh(days)` and `TodoPanel.load(days)`. |
| `src/components/InputHandler.ts` | `InputHandler` | Reads textarea, detects command prefix, fires `onSubmit` callback |
| `src/components/ChatArea.ts` | `ChatArea` | Renders the central chat-style feed; today's section is at the top, past days are collapsible below. Tracks `todaySection` separately — call `focusToday()` after loading so new entries always land in today's section. |
| `src/components/TodoPanel.ts` | `TodoPanel` | Manages the right-panel `TodoItem` list; sections: Important → Due/Overdue → Open → Completed. Call `setOnComplete(cb)` to receive a callback whenever a todo is completed or reopened (used to refresh the sidebar count). `load(days?)` accepts an optional cutoff so completed todos older than `days` days are excluded. Open todos show inline chips: clicking the importance chip (`☆`/`★`) directly toggles `is_important`; clicking the deadline chip opens an inline `div.todo-meta-edit` form for editing the due date. |
| `src/components/Sidebar.ts` | `Sidebar` | Left panel; lists past `DayEntry` days with preview and stats. `refresh(days?)` accepts an optional day count (stored internally) to LIMIT the query. |
| `src/components/LogModal.ts` | `LogModal` | Overlay modal showing all log entries for the month, grouped by day; each day also lists todos completed that day in a "Completed Todos" sub-section. Footer has an Export .md button wired to `exportMarkdown()` |
| `src/components/SettingsModal.ts` | `SettingsModal` | LLM provider/key/model/chat_days configuration overlay. Call `setOnSave(cb)` to register a callback invoked after a successful save (used by `App` to trigger `applyChatDays()`). |
| `src/components/ArchiveModal.ts` | `ArchiveModal` | Full-year calendar archive grouped by week; search entries by keyword, click a day to open its log via `onDaySelect` callback. Uses `buildWeeks()` from `src/archiveUtils.ts`. |
| `src/components/ArchiveConfirmModal.ts` | `ArchiveConfirmModal` | Confirmation dialog shown before permanently deleting archive entries. Call `show(title, body, onConfirm)` to display with a custom message; fires `onConfirm` only if the user clicks Delete. |

**Archive utilities** live in `src/archiveUtils.ts`: exports `DayData`, `WeekData`, `getWeekStart()`, and `buildWeeks()` — helpers that aggregate DB rows into week buckets for the `ArchiveModal`.

**Log aggregation** lives in `src/logAggregation.ts`: exports `DayLog` and `buildDayLogs(entries, completedTodos)` — groups log entries and completed todos into per-day buckets (sorted date-descending, todo-only days included). Shared by `App.openLogModal()` (View Log) and `exportMarkdown()` so both surfaces show completed todos. A todo's day is keyed off `completed_at`, matching the sidebar count.

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

- Component tests (`__tests__/components/`) are integration tests — they bootstrap the full app via `import('../../app.js')` and interact through the DOM.
- Unit tests exist for `commands`, `todoLogic`, `utils`, `ai`, `db`, `export`, and `llm/`.
- Test environment: Vitest + happy-dom. Tauri plugins are mocked in `src/__mocks__/tauri-plugins.ts`.

## Key conventions

- Frontend IPC calls use `@tauri-apps/api` (`invoke`), not `withGlobalTauri`
- New Rust commands must be registered in `tauri::generate_handler![]` in `lib.rs`
- The Tauri dev server expects port 1420 (`strictPort: true` in `vite.config.ts`)
- Package manager: **pnpm**
- All ESM imports use `.js` extension (Vite requirement), even for `.ts` source files
- DB access goes through `src/db.ts` (`query`, `execute`, `getSetting`, `setSetting`) — never import `tauri-plugin-sql` directly in components
- The `tauri` Rust crate and `@tauri-apps/api` / `@tauri-apps/cli` npm packages must share the same `major.minor`. If you bump one, bump the others (`pnpm update @tauri-apps/api @tauri-apps/cli`).
- On Windows, `pnpm tauri build` fails with `LNK1104: msvcrt.lib` unless the MSVC env vars are loaded. Use `scripts/build-windows.ps1` or run from "x64 Native Tools Command Prompt for VS 2022". Partial VS installs that only ship the OneCore CRT subset will not work — the full "Desktop development with C++" workload is required.
