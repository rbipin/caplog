# Rename DayLog → CapLog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every occurrence of "DayLog"/"daylog"/"daylog_lib" with "CapLog"/"caplog"/"caplog_lib" across source, config, UI, tests, and documentation.

**Architecture:** Pure find-and-replace across 14 files — no logic changes, no new files. Changes are grouped by concern (tests → source → config → UI → docs) so each commit is independently coherent.

**Tech Stack:** TypeScript/Vite frontend, Rust/Tauri v2 backend, SQLite via tauri-plugin-sql, Vitest tests.

---

## Rename Reference

| Old | New |
|-----|-----|
| `DayLog` | `CapLog` |
| `daylog` | `caplog` |
| `daylog_lib` | `caplog_lib` |
| `daylog.db` | `caplog.db` |
| `com.bipin.daylog` | `com.bipin.caplog` |

---

### Task 1: Update export tests

**Files:**
- Modify: `src/__tests__/export.test.ts:70,80,89,92`

- [ ] **Step 1: Edit export.test.ts — update defaultPath assertion (line 70)**

Change:
```typescript
        defaultPath: expect.stringMatching(/daylog-export.*\.md/),
```
To:
```typescript
        defaultPath: expect.stringMatching(/caplog-export.*\.md/),
```

- [ ] **Step 2: Edit export.test.ts — update heading assertion (line 80)**

Change:
```typescript
    expect(md).toContain('# DayLog Export');
```
To:
```typescript
    expect(md).toContain('# CapLog Export');
```

- [ ] **Step 3: Edit export.test.ts — update heading regex assertion (line 92)**

Change:
```typescript
    expect(md).toMatch(/^# DayLog Export/);
```
To:
```typescript
    expect(md).toMatch(/^# CapLog Export/);
```

- [ ] **Step 4: Run tests — expect 2 failures (tests now expect CapLog but source still says DayLog)**

```bash
pnpm test
```
Expected: 2 tests fail — `save() is called with... default path` and `output starts with a top-level # DayLog Export heading`.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/export.test.ts
git commit -m "test: update export assertions for CapLog rename"
```

---

### Task 2: Update export source

**Files:**
- Modify: `src/export.ts:25,35`

- [ ] **Step 1: Edit export.ts — update markdown heading (line 25)**

Change:
```typescript
  let md = '# DayLog Export\n\n';
```
To:
```typescript
  let md = '# CapLog Export\n\n';
```

- [ ] **Step 2: Edit export.ts — update default export filename (line 35)**

Change:
```typescript
    defaultPath: `daylog-export-${today}.md`,
```
To:
```typescript
    defaultPath: `caplog-export-${today}.md`,
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
pnpm test
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/export.ts
git commit -m "feat: rename DayLog → CapLog in export output"
```

---

### Task 3: Update database path in TypeScript and Rust

**Files:**
- Modify: `src/db.ts:6`
- Modify: `src-tauri/src/lib.rs:10`
- Modify: `src-tauri/src/main.rs:5`

- [ ] **Step 1: Edit src/db.ts — update SQLite path (line 6)**

Change:
```typescript
  db = await Database.load('sqlite:daylog.db');
```
To:
```typescript
  db = await Database.load('sqlite:caplog.db');
```

- [ ] **Step 2: Edit src-tauri/src/lib.rs — update SQLite path (line 10)**

Change:
```rust
                    "sqlite:daylog.db",
```
To:
```rust
                    "sqlite:caplog.db",
```

- [ ] **Step 3: Edit src-tauri/src/main.rs — update lib crate call (line 5)**

Change:
```rust
    daylog_lib::run()
```
To:
```rust
    caplog_lib::run()
```

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
pnpm test
```
Expected: All tests pass (DB path is mocked in tests).

- [ ] **Step 5: Commit**

```bash
git add src/db.ts src-tauri/src/lib.rs src-tauri/src/main.rs
git commit -m "feat: rename database path and Rust lib to caplog"
```

---

### Task 4: Update build configuration

**Files:**
- Modify: `package.json:2`
- Modify: `src-tauri/Cargo.toml:2,14`
- Modify: `src-tauri/tauri.conf.json:3,5,16`

- [ ] **Step 1: Edit package.json — update package name (line 2)**

Change:
```json
  "name": "daylog",
```
To:
```json
  "name": "caplog",
```

- [ ] **Step 2: Edit src-tauri/Cargo.toml — update binary name (line 2)**

Change:
```toml
name = "daylog"
```
To:
```toml
name = "caplog"
```

- [ ] **Step 3: Edit src-tauri/Cargo.toml — update lib name (line 14)**

Change:
```toml
name = "daylog_lib"
```
To:
```toml
name = "caplog_lib"
```

- [ ] **Step 4: Edit src-tauri/tauri.conf.json — update productName (line 3)**

Change:
```json
  "productName": "daylog",
```
To:
```json
  "productName": "caplog",
```

- [ ] **Step 5: Edit src-tauri/tauri.conf.json — update identifier (line 5)**

Change:
```json
  "identifier": "com.bipin.daylog",
```
To:
```json
  "identifier": "com.bipin.caplog",
```

- [ ] **Step 6: Edit src-tauri/tauri.conf.json — update window title (line 16)**

Change:
```json
        "title": "daylog",
```
To:
```json
        "title": "caplog",
```

- [ ] **Step 7: Run type-check + tests**

```bash
pnpm build && pnpm test
```
Expected: Build succeeds, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "feat: rename package name, Cargo crate, and Tauri config to caplog"
```

---

### Task 5: Update UI

**Files:**
- Modify: `index.html:6,17,64`

- [ ] **Step 1: Edit index.html — update page title (line 6)**

Change:
```html
    <title>DayLog</title>
```
To:
```html
    <title>CapLog</title>
```

- [ ] **Step 2: Edit index.html — update header logo (line 17)**

Change:
```html
        <div class="header-logo">DayLog</div>
```
To:
```html
        <div class="header-logo">CapLog</div>
```

- [ ] **Step 3: Edit index.html — update modal title (line 64)**

Change:
```html
            <div class="modal-title">DayLog</div>
```
To:
```html
            <div class="modal-title">CapLog</div>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: rename UI labels from DayLog to CapLog"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `plan.md`
- Modify: `sample/daylog-mock.html`
- Modify: `docs/superpowers/plans/2026-05-31-daylog-persistence.md`
- Modify: `docs/superpowers/plans/2026-06-02-entry-todo-enhancements.md`
- Modify: `docs/superpowers/specs/2026-06-01-tests-design.md`
- Modify: `docs/superpowers/specs/2026-06-02-entry-todo-enhancements-design.md`

- [ ] **Step 1: Replace all occurrences in documentation files**

Run these replacements across all doc files (use Edit tool for each, replacing all occurrences of `DayLog` → `CapLog` and `daylog` → `caplog`):

Files to update (replace all `DayLog` → `CapLog` and `daylog` → `caplog`):
- `README.md`
- `CLAUDE.md`
- `plan.md`
- `sample/daylog-mock.html`
- `docs/superpowers/plans/2026-05-31-daylog-persistence.md`
- `docs/superpowers/plans/2026-06-02-entry-todo-enhancements.md`
- `docs/superpowers/specs/2026-06-01-tests-design.md`
- `docs/superpowers/specs/2026-06-02-entry-todo-enhancements-design.md`

- [ ] **Step 2: Verify no `daylog` or `DayLog` strings remain (outside target/ and .claude/)**

```bash
grep -r "DayLog\|daylog" /Users/bipin/repo/daylog \
  --include="*.ts" --include="*.rs" --include="*.md" \
  --include="*.json" --include="*.html" --include="*.toml" \
  --exclude-dir=target --exclude-dir=node_modules \
  --exclude="settings.local.json"
```
Expected: Only the new spec/plan files (which legitimately contain `DayLog` in their historical context) and possibly the memory file. No occurrences in source or config files.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md plan.md sample/daylog-mock.html \
  docs/superpowers/plans/2026-05-31-daylog-persistence.md \
  docs/superpowers/plans/2026-06-02-entry-todo-enhancements.md \
  docs/superpowers/specs/2026-06-01-tests-design.md \
  docs/superpowers/specs/2026-06-02-entry-todo-enhancements-design.md
git commit -m "docs: rename DayLog → CapLog in all documentation"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```
Expected: All tests pass with no failures or warnings.

- [ ] **Step 2: Run type-check + frontend build**

```bash
pnpm build
```
Expected: Exits with code 0, no TypeScript errors.

- [ ] **Step 3: Note on existing database data**

If you have an existing `daylog.db` on disk from prior development runs, rename it so the app can find it under the new name. On macOS:

```bash
# Development data (Tauri stores it in app data dir)
APP_DIR="$HOME/Library/Application Support/daylog"
if [ -d "$APP_DIR" ]; then
  mv "$APP_DIR" "$HOME/Library/Application Support/caplog"
  mv "$HOME/Library/Application Support/caplog/daylog.db" \
     "$HOME/Library/Application Support/caplog/caplog.db"
  echo "Migrated app data directory"
else
  echo "No existing app data found — nothing to migrate"
fi
```

If no existing data exists (fresh dev environment), skip this step.
