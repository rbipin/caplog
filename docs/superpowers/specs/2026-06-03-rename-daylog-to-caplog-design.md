# Rename DayLog → CapLog

**Date:** 2026-06-03  
**Status:** Approved

## Goal

Rename the project from DayLog to CapLog across all source files, configuration, documentation, and the SQLite database path. The git repository directory name (`daylog/`) is out of scope — the user handles that separately if needed.

## Rename Mapping

| Old | New |
|-----|-----|
| `DayLog` | `CapLog` |
| `daylog` | `caplog` |
| `daylog_lib` | `caplog_lib` |
| `daylog.db` | `caplog.db` |
| `com.bipin.daylog` | `com.bipin.caplog` |

## Files to Update

### Config / build

| File | Change |
|------|--------|
| `package.json` | `"name": "daylog"` → `"name": "caplog"` |
| `src-tauri/Cargo.toml` | binary `name = "daylog"` → `"caplog"`, lib `name = "daylog_lib"` → `"caplog_lib"` |
| `src-tauri/tauri.conf.json` | `productName`, `identifier` (`com.bipin.daylog` → `com.bipin.caplog`), window `title` |

### UI

| File | Change |
|------|--------|
| `index.html` | `<title>DayLog</title>`, header logo div, modal title |

### Source code

| File | Change |
|------|--------|
| `src-tauri/src/main.rs` | `daylog_lib::run()` → `caplog_lib::run()` |
| `src-tauri/src/lib.rs` | `sqlite:daylog.db` → `sqlite:caplog.db` |
| `src/db.ts` | `sqlite:daylog.db` → `sqlite:caplog.db` |
| `src/export.ts` | `# DayLog Export` heading, `daylog-export-*.md` default filename |

### Tests

| File | Change |
|------|--------|
| `src/__tests__/export.test.ts` | Assertions matching `# DayLog Export` and `daylog-export-*.md` |

### Documentation

| File | Change |
|------|--------|
| `README.md` | All occurrences |
| `CLAUDE.md` | All occurrences |
| `plan.md` | All occurrences |
| `sample/daylog-mock.html` | All occurrences |
| `docs/superpowers/plans/2026-05-31-daylog-persistence.md` | All occurrences |
| `docs/superpowers/plans/2026-06-02-entry-todo-enhancements.md` | All occurrences |
| `docs/superpowers/specs/2026-06-01-tests-design.md` | All occurrences |
| `docs/superpowers/specs/2026-06-02-entry-todo-enhancements-design.md` | All occurrences |

## What Is Skipped

- `src-tauri/target/` — build artifacts, regenerated automatically on next build
- `.claude/settings.local.json` — tool permission rules only, no display names

## Data Migration Note

The SQLite database file on disk is still named `daylog.db` at existing installation paths. After the rename, users must manually rename it:

```
# macOS (Tauri app data)
mv ~/Library/Application\ Support/daylog/daylog.db \
   ~/Library/Application\ Support/caplog/caplog.db
```

Alternatively, the Rust startup code in `lib.rs` could check for `daylog.db` and copy/rename it automatically on first run — this is a nice-to-have and can be added as a follow-up.

## Approach

Edit each file directly (targeted replacements), skipping build artifacts. All changes are purely textual find-and-replace — no logic or structural changes.

## Verification

After all edits:
1. `pnpm build` — type-check passes
2. `pnpm test` — all tests pass (export tests assert new `caplog` strings)
3. `pnpm tauri dev` — app launches, title bar shows "CapLog"
