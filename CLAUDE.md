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

# Build the distributable Tauri app
pnpm tauri build
```

There is no test suite yet.

## Architecture

DayLog is a **Tauri v2** desktop app: a Vite + Vanilla TypeScript frontend talking to a Rust backend via Tauri's IPC (`invoke`).

### Frontend (`src/`)

All UI logic lives in `src/main.ts` as class-per-component:

| Class | Responsibility |
|---|---|
| `App` | Root orchestrator; wires all components together |
| `InputHandler` | Reads the textarea, detects command prefix, fires `onSubmit` callback |
| `ChatArea` | Renders the central chat-style feed of `Message` objects |
| `TodoPanel` | Manages the right-panel `TodoItem` list; sections: Important → Upcoming → Open → Completed |
| `Sidebar` | Left panel; lists past `DayEntry` days |
| `LogModal` | Overlay modal showing all log entries for the month |

**Command parsing** is handled in `App.handleInput()`. Plain text → `log` message. `/todo`, `/done`, `/important`, `/by` are the recognized slash commands.

**Styles and fonts** are in `src/styles.css`. Fonts: Instrument Serif (headings) + DM Mono (body). Dark theme via CSS custom properties (`--bg`, `--surface`, `--text`, etc.).

### Backend (`src-tauri/src/`)

- `lib.rs` — Tauri app setup; all commands registered via `invoke_handler`
- `main.rs` — entry point that calls `lib::run()`

**Currently only the boilerplate `greet` command exists.** `tauri-plugin-sql` (SQLite) is already wired as a dependency for future persistence — no tables or migrations exist yet.

### Design reference

`sample/daylog-mock.html` is the canonical UI reference — a self-contained file with working JS, dark theme, and all three-column layout. Match it for visual design and interactions when building features.

## Key conventions

- Frontend IPC calls use `@tauri-apps/api` (`invoke`), not `withGlobalTauri`
- New Rust commands must be registered in `tauri::generate_handler![]` in `lib.rs`
- The Tauri dev server expects port 1420 (`strictPort: true` in `vite.config.ts`)
- Package manager: **pnpm**
