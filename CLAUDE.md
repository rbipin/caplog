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
```

## Architecture

DayLog is a **Tauri v2** desktop app: a Vite + Vanilla TypeScript frontend talking to a Rust backend via Tauri's IPC (`invoke`). The UI has three columns: Sidebar (past days), ChatArea (log feed + input), TodoPanel (task list).

### Frontend (`src/`)

Each UI class lives in its own file under `src/components/`. `src/app.ts` is the entry point — it instantiates all components and wires them together in the `App` class.

| File | Class | Responsibility |
|------|-------|----------------|
| `src/app.ts` | `App` | Root orchestrator; wires all components, registers DOMContentLoaded |
| `src/components/InputHandler.ts` | `InputHandler` | Reads textarea, detects command prefix, fires `onSubmit` callback |
| `src/components/ChatArea.ts` | `ChatArea` | Renders the central chat-style feed of `Message` objects; handles inline edit |
| `src/components/TodoPanel.ts` | `TodoPanel` | Manages the right-panel `TodoItem` list; sections: Important → Due/Overdue → Upcoming → Open → Completed |
| `src/components/Sidebar.ts` | `Sidebar` | Left panel; lists past `DayEntry` days with preview and stats |
| `src/components/LogModal.ts` | `LogModal` | Overlay modal showing all log entries for the month |
| `src/components/SettingsModal.ts` | `SettingsModal` | LLM provider/key/model configuration overlay |

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

### Design reference

`sample/daylog-mock.html` is the canonical UI reference — a self-contained file with working JS, dark theme, and all three-column layout. Match it for visual design and interactions when building features.

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
