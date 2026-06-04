# Test Suite Design — CapLog

**Date:** 2026-06-01
**Status:** Completed
**Scope:** Unit + component tests for all TypeScript source modules
**Framework:** Vitest + jsdom

---

## 1. Framework Setup

### Dependencies (devDependencies)

- `vitest` — test runner with native Vite integration
- `jsdom` — browser environment for DOM-dependent classes
- `@vitest/coverage-v8` — V8 coverage reporting

### Vitest configuration

Add a `test` block to `vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  coverage: { provider: 'v8', include: ['src/**'] },
}
```

### Scripts (package.json)

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### File layout

Tests live in `src/__tests__/` mirroring the source tree:

```
src/
  __tests__/
    utils.test.ts
    commands.test.ts
    todoLogic.test.ts
    db.test.ts
    ai.test.ts
    export.test.ts
    llm/
      anthropic.test.ts
      openai.test.ts
      factory.test.ts
    components/
      TodoPanel.test.ts
      ChatArea.test.ts
      SettingsModal.test.ts
```

---

## 2. Tauri Mock Strategy

Tests run outside a Tauri runtime. Each test file that imports a Tauri-bound module stubs it with `vi.mock` at the top of the file.

| Tauri module | Used in | What gets stubbed |
|---|---|---|
| `@tauri-apps/plugin-sql` | `db.ts` | `Database.load()`, `.select()`, `.execute()` |
| `@tauri-apps/plugin-dialog` | `export.ts` | `save()` returning a controlled path or `null` |
| `@tauri-apps/plugin-fs` | `export.ts` | `writeTextFile()` as a no-op spy |

Shared mock factory helpers live in `src/__mocks__/tauri-plugins.ts` and are imported by the test files that need them. Mocks are explicit per file — no global auto-mocks.

---

## 3. Module Extraction from main.ts

Three pure-logic modules are extracted from `main.ts` to make them independently testable:

### `src/types.ts`
Moves the shared TypeScript interfaces out of `main.ts` so extracted modules can import them without circular dependencies: `TodoItem`, `LogEntry`, `DayStats`, `Message`, `MessageType`. `main.ts` re-exports or simply imports from here.

### `src/utils.ts`
Exports `escapeHtml(s: string): string` and `stripHtml(html: string): string`.  
Both are currently defined at the top of `main.ts` and used in multiple places.

### `src/commands.ts`
Exports `parseCommand(input: string): ParsedCommand` where `ParsedCommand` is a discriminated union:

```ts
type ParsedCommand =
  | { type: 'log'; text: string }
  | { type: 'todo'; text: string; deadline: string | null }
  | { type: 'important'; text: string }
  | { type: 'done'; task: string }
  | { type: 'empty' }
```

The `if/else` dispatch block in `App.handleInput()` becomes a call to `parseCommand`, with `App` handling only side effects.

### `src/todoLogic.ts`
Exports:
- `todoStatus(todo: TodoItem): 'completed' | 'important' | 'overdue' | 'open'`
- `getTodoSections(): { label: string; filter: (t: TodoItem) => boolean }[]`

Both are currently inlined in `TodoPanel`. `TodoPanel.render()` calls these instead.

---

## 4. Test Coverage Map

### Pure utilities

**`utils.test.ts`**
- `escapeHtml` escapes `&`, `<`, `>`, `"`
- `escapeHtml` leaves unescaped characters unchanged
- `stripHtml` returns text content of a simple tag
- `stripHtml` handles nested tags and returns flattened text

**`commands.test.ts`**
- `/todo Buy milk` → `{ type: 'todo', text: 'Buy milk', deadline: null }`
- `/todo Buy milk /by 2026-06-10` → includes deadline
- `/todo` with no text → `{ type: 'empty' }`
- `/done task name` → `{ type: 'done', task: 'task name' }`
- `/important Fix bug` → `{ type: 'important', text: 'Fix bug' }`
- Plain text → `{ type: 'log', text: '...' }`
- Whitespace-only input → `{ type: 'empty' }`
- Leading whitespace before command is trimmed

**`todoLogic.test.ts`**
- Completed todo → `'completed'`
- Important + incomplete → `'important'`
- Past deadline + incomplete → `'overdue'`
- No deadline, not important, not completed → `'open'`
- `getTodoSections()` — important section excludes completed items
- `getTodoSections()` — overdue section excludes important items
- `getTodoSections()` — open section excludes items with past deadline

### LLM layer

**`llm/anthropic.test.ts`** (mock `fetch`)
- Happy path: returns trimmed `content[0].text`
- HTTP error response throws with status code in message
- Response body missing `content` array throws

**`llm/openai.test.ts`** (mock `fetch`)
- Happy path: returns trimmed `choices[0].message.content`
- HTTP error response throws
- `baseUrl` trailing slash is normalised before appending `/v1/chat/completions`
- Response body missing `choices` throws

**`llm/factory.test.ts`** (mock `db.ts`)
- No `llm_provider` setting → returns `null`
- `llm_provider=anthropic`, key present → returns `AnthropicAdapter`
- `llm_provider=openai`, key + baseUrl present → returns `OpenAIAdapter`
- `llm_provider=openai`, no `baseUrl` → returns `null`
- Legacy `anthropic_api_key` present, no `llm_provider` → migrates settings and returns `AnthropicAdapter`

**`ai.test.ts`** (mock `LLMAdapter`)
- Calls `adapter.complete` with the correct system prompt and raw text
- Returns trimmed result from adapter
- Propagates error thrown by adapter

### Database

**`db.test.ts`** (mock `@tauri-apps/plugin-sql`)
- `query` delegates to `db.select` with correct SQL and params
- `execute` delegates to `db.execute`
- `getSetting` returns value when row found
- `getSetting` returns `null` when no rows
- `setSetting` calls `execute` with upsert SQL
- Calling `query`/`execute` before `initDB` throws `'DB not initialized'`

### Export

**`export.test.ts`** (mock `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `db.ts`)
- Entries are grouped by date with correct `## Weekday, Month Day, Year` headings
- HTML is stripped from `formatted_text` in output lines
- `save()` is called; if it returns a path, `writeTextFile` is called with markdown
- If `save()` returns `null`, `writeTextFile` is not called

### UI components (jsdom + mocked db)

**`TodoPanel.test.ts`**
- `add()` calls `execute` with correct INSERT and calls `load()`
- `complete(id)` calls `execute` with UPDATE setting `is_completed = 1`
- `completeByText` finds matching todo and completes it; returns `false` when none match
- `delete(id)` calls `execute` with DELETE
- `render()` — important items appear under "Important" label
- `render()` — overdue items appear under "Due / Overdue" label
- `render()` — open count and done count in count element match data
- Completed items show checkmark; incomplete items show click-to-complete handler

**`SettingsModal.test.ts`**
- `open()` reads all four settings from db and populates inputs
- Base-URL group is hidden when provider is `anthropic`
- Base-URL group is visible when provider is `openai`
- `save()` with empty API key deletes all four setting rows
- `save()` with valid inputs writes provider, key, model, baseUrl to db
- `save()` with missing model name calls `alert` and does not close

**`ChatArea.test.ts`**
- `append()` renders time, type label, and content in correct elements
- `append()` with `rawInput` renders the original-input block
- `append()` with `entryId` attaches click handler to content element
- Edit flow: clicking content replaces it with textarea; Cancel restores original HTML
- `loadEntries()` renders multiple entries in order

---

## 5. Out of Scope

- `Sidebar` — read-only rendering of db query results; low logic density, deferred
- `LogModal` — trivial open/close + string concatenation; deferred
- `InputHandler` — textarea event wiring; deferred
- `App` — integration-level orchestrator; covered indirectly by component tests
- End-to-end / Playwright tests — out of scope for this phase
