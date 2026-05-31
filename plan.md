# DayLog — Implementation Plan

> A native desktop productivity app built with Tauri + vanilla JS + SQLite.
> Cross-platform: macOS and Windows.

---

## Overview

DayLog is a chat-style desktop app with three core features:

- **Daily log** — type naturally, AI cleans and formats entries into bullet points
- **Todo list** — persistent, command-driven, auto-rolls forward daily
- **Export** — view or export log history as a markdown file

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Desktop shell | Tauri v2 | Lightweight, cross-platform, no bundled Chromium |
| Frontend | Vanilla HTML/CSS/JS | Mock UI already built, no framework needed |
| Database | SQLite via Tauri plugin | Local, fast, offline, no rate limits |
| AI formatting | Claude Haiku API | Cheapest model, sufficient for text cleanup |
| API key storage | Tauri Store plugin | Secure local storage, not exposed in frontend |
| Packaging | Tauri build | Produces `.dmg` (Mac) and `.msi` (Windows) |

---

## Data Model

Two tables. That's it.

```sql
CREATE TABLE IF NOT EXISTS log_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,           -- YYYY-MM-DD
  raw_text     TEXT NOT NULL,           -- original user input
  formatted_text TEXT NOT NULL,         -- AI-cleaned bullet points
  created_at   TEXT NOT NULL            -- ISO timestamp
);

CREATE TABLE IF NOT EXISTS todos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  text         TEXT NOT NULL,
  is_important INTEGER DEFAULT 0,       -- 1 = important, sorts to top
  is_completed INTEGER DEFAULT 0,       -- 1 = done
  deadline     TEXT,                    -- YYYY-MM-DD, nullable = open todo
  created_at   TEXT NOT NULL,
  completed_at TEXT                     -- nullable
);
```

### Todo Rules

- All todos are always "today's" — no daily migration, just always query active list
- Dated todos highlight when `deadline <= today`
- Sort order: `is_important DESC, deadline ASC NULLS LAST, created_at ASC`
- Completed todos are archived, not deleted

---

## Command Syntax

| Input | Action |
|---|---|
| Any text without `/` prefix | Log entry — sent to AI for formatting |
| `/todo <text>` | Create new open todo |
| `/todo <text> /by <date>` | Create dated todo with deadline |
| `/done <text>` | Mark matching todo complete (or click todo) |
| `/important <text>` | Create todo marked as important |
| `/important` on existing | Promote existing todo to top |

---

## Project Structure

```
daylog/
├── src/
│   ├── index.html          # Main UI (from mock)
│   ├── styles.css          # All styles extracted
│   ├── main.js             # App logic, DB calls, command routing
│   ├── db.js               # Database abstraction layer
│   ├── ai.js               # API call for log formatting
│   └── export.js           # Markdown export logic
├── src-tauri/
│   ├── src/
│   │   └── main.rs         # Tauri entry point (minimal boilerplate)
│   ├── migrations/
│   │   └── 001_init.sql    # Schema definition
│   ├── tauri.conf.json     # App config, window size, permissions
│   └── Cargo.toml          # Rust dependencies
└── package.json
```

---

## Phase 1 — Environment Setup

**Estimated time: 1–2 days**

### Tasks

1. Install Rust via [rustup.rs](https://rustup.rs)
2. Install Node.js LTS
3. Install Tauri CLI: `npm install -g @tauri-apps/cli`
4. Install platform dependencies:
   - **macOS**: `xcode-select --install`
   - **Windows**: Microsoft C++ Build Tools + WebView2 runtime
5. Verify: `cargo --version`, `node --version`, `npx tauri --version`

> Do not proceed until all three commands respond correctly. The build environment is the most common friction point in this entire project.

### Milestone

`cargo --version`, `node --version`, and `npx tauri --version` all return without errors.

---

## Phase 2 — Project Scaffold

**Estimated time: 1 day**

### Tasks

1. Create project:

   ```bash
   npm create tauri-app@latest daylog
   cd daylog
   ```

   Choose: vanilla HTML/CSS/JS, no framework.

2. Move mock UI into `src/index.html`
3. Extract CSS into `src/styles.css`
4. Extract JS into `src/main.js`
5. Run dev server: `npx tauri dev`

### Milestone

Mock UI opens in a native desktop window. Sidebar collapses. View Log modal opens. Input highlights on `/` commands. All visual interactions work exactly as in the browser mock.

---

## Phase 3 — Database Setup

**Estimated time: 2–3 days**

### Tasks

1. Install SQLite plugin:

   ```bash
   npm install @tauri-apps/plugin-sql
   ```

   Add to `Cargo.toml`:

   ```toml
   tauri-plugin-sql = { features = ["sqlite"] }
   ```

2. Write schema in `src-tauri/migrations/001_init.sql`

3. Initialize DB in `src/db.js`:

   ```javascript
   import Database from '@tauri-apps/plugin-sql';

   let db;

   export async function initDB() {
     db = await Database.load('sqlite:daylog.db');
     return db;
   }

   export async function query(sql, params = []) {
     return db.select(sql, params);
   }

   export async function execute(sql, params = []) {
     return db.execute(sql, params);
   }
   ```

4. Test: insert a row manually and read it back before wiring to UI.

### Milestone

DB initializes on app start with no console errors. A manual test insert persists after app restart.

---

## Phase 4 — Core Features

**Estimated time: 1 week**

Build in this order. Each step is testable before moving to the next.

### 4a — Todo CRUD

Wire command parsing and DB operations for todos. No AI involved — start here.

**Command routing in `main.js`:**

```javascript
function handleInput(value) {
  const v = value.trim();
  if (v.startsWith('/todo'))     return handleTodo(v);
  if (v.startsWith('/done'))     return handleDone(v);
  if (v.startsWith('/important')) return handleImportant(v);
  return handleLogEntry(v);        // default: log entry
}
```

**Todo operations:**

```javascript
// Create
await execute(
  'INSERT INTO todos (text, is_important, deadline, created_at) VALUES (?, ?, ?, ?)',
  [text, isImportant ? 1 : 0, deadline || null, new Date().toISOString()]
);

// Complete
await execute(
  'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
  [new Date().toISOString(), id]
);

// Load active todos
const todos = await query(
  'SELECT * FROM todos WHERE is_completed = 0 ORDER BY is_important DESC, deadline ASC, created_at ASC'
);
```

**Milestone:** Todos persist across app restarts. Clicking a todo completes it. `/important` pushes to top. Dated todos show deadline.

---

### 4b — Log Entries (without AI)

Save raw text as both `raw_text` and `formatted_text` initially. Wire the real display.

```javascript
async function handleLogEntry(rawText) {
  const today = new Date().toISOString().split('T')[0];
  await execute(
    'INSERT INTO log_entries (date, raw_text, formatted_text, created_at) VALUES (?, ?, ?, ?)',
    [today, rawText, rawText, new Date().toISOString()]
  );
  renderLogEntry({ raw: rawText, formatted: rawText });
}
```

Load today's entries on startup:

```javascript
const today = new Date().toISOString().split('T')[0];
const entries = await query(
  'SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC',
  [today]
);
```

Load sidebar history:

```javascript
const history = await query(
  'SELECT date, COUNT(*) as count FROM log_entries GROUP BY date ORDER BY date DESC LIMIT 30'
);
```

**Milestone:** Log entries save and reload correctly on restart. Sidebar shows correct dates and entry counts.

---

### 4c — AI Formatting

Replace the raw-text placeholder with a real API call. Add a loading state to the input while the call is in flight.

**`src/ai.js`:**

```javascript
export async function formatLogEntry(rawText, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Clean up and format this into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points with no preamble or explanation:\n\n${rawText}`
      }]
    })
  });

  if (!response.ok) throw new Error('API call failed');
  const data = await response.json();
  return data.content[0].text;
}
```

**Loading state:** disable the input and show a subtle spinner while the API call is in flight. Re-enable on completion or error.

**Fallback:** if no API key is set, save raw text as-is and show a warning prompt to add a key in settings.

**Milestone:** Typing a log entry and submitting returns AI-formatted bullet points within 1–2 seconds. Raw input is preserved in the DB alongside formatted output.

---

## Phase 5 — Remaining UI Features

**Estimated time: 3–4 days**

### 5a — View Log Modal (real data)

Replace mock entries in the modal with a real DB query grouped by date:

```javascript
async function openLogModal() {
  const entries = await query(
    'SELECT * FROM log_entries ORDER BY date DESC, created_at ASC'
  );
  // group by date, render into modal
  renderModal(groupByDate(entries));
}
```

### 5b — Markdown Export

```javascript
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

async function exportMarkdown() {
  const entries = await query(
    'SELECT * FROM log_entries ORDER BY date DESC, created_at ASC'
  );

  let md = '# DayLog Export\n\n';
  const grouped = groupByDate(entries);

  for (const [date, items] of Object.entries(grouped)) {
    md += `## ${formatDate(date)}\n\n`;
    for (const item of items) {
      md += item.formatted_text + '\n\n';
    }
  }

  const path = await save({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    defaultPath: `daylog-export-${new Date().toISOString().split('T')[0]}.md`
  });

  if (path) await writeTextFile(path, md);
}
```

### 5c — Settings Panel

Add a minimal settings view (gear icon in header) containing:

- API key input — stored via `@tauri-apps/plugin-store`, never in JS variables
- Toggle: show/hide raw input below formatted log entries
- Button: clear completed todos older than 30 days

**Milestone:** Export produces a valid, well-structured `.md` file. Settings persist across restarts. API key is not visible in DevTools.

---

## Phase 6 — Polish

**Estimated time: 2–3 days**

- Loading spinner on AI call in flight
- Error state if API call fails (show raw text, display retry option)
- Empty states — first launch, no todos, no log entries
- Keyboard shortcuts: `Cmd/Ctrl + E` to export, `Escape` to close modal
- Window size and minimum dimensions set in `tauri.conf.json`
- App icon (`.icns` for Mac, `.ico` for Windows)

---

## Phase 7 — Build & Package

**Estimated time: 1–2 days**

### Build command

```bash
npx tauri build
```

### Output locations

| Platform | Output |
|---|---|
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg` |
| Windows | `src-tauri/target/release/bundle/msi/*.msi` |

### Cross-platform builds

Tauri does not cross-compile. You must build on each target platform.

- **macOS build**: run on your Mac
- **Windows build**: use GitHub Actions with a Windows runner

Tauri provides a ready-made GitHub Actions workflow for this. Add it to `.github/workflows/build.yml` and it will produce both installers on every push to `main`.

### Milestone

A `.dmg` installs and runs on macOS. An `.msi` installs and runs on Windows. Both connect to their local SQLite database independently.

---

## Milestone Summary

| Phase | Milestone | Est. Time |
|---|---|---|
| 1 — Environment | Toolchain verified on all three commands | 1–2 days |
| 2 — Scaffold | Mock UI runs in native window | 1 day |
| 3 — Database | DB initializes, test insert persists | 2–3 days |
| 4a — Todos | Todos persist and sort correctly | 2–3 days |
| 4b — Logging | Log entries save and load by date | 1–2 days |
| 4c — AI | Formatted bullet points appear in UI | 1 day |
| 5 — Features | Export works, settings persist | 3–4 days |
| 6 — Polish | Loading states, errors, empty states | 2–3 days |
| 7 — Build | Installable `.dmg` and `.msi` exist | 1–2 days |
| **Total** | | **4–6 weeks part-time** |

---

## Known Risk Areas

**Rust environment on Windows** is the most common blocker. Budget a full day just for setup. If the build fails, check that `MSVC` build tools and WebView2 are both installed.

**AI latency** will feel broken without a loading state. This is non-negotiable — add it in Phase 4c before anything else in Phase 5.

**SQLite dates** are stored as strings. Always use `YYYY-MM-DD` ISO format. Filter with string comparison — it works correctly and reliably without any date library.

**API key security** — never hardcode the key in JS. Always read from Tauri Store at runtime. If the user hasn't set a key, show a clear prompt in the settings panel rather than a cryptic error.

---

## Future Features (Post-v1)

These are explicitly out of scope for v1 but worth noting:

- Semantic search across log history using EmbeddingGemma (local, no API cost)
- Optional Notion sync as a secondary destination (not primary DB)
- Weekly summary generation from log entries
- System tray with quick-entry popup
- Mobile companion via sync to a shared file
