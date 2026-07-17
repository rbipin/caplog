# Notes Scratchpad + App Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single undated, autosaving plain-text scratchpad note reachable from the header, and fix the app's drifted version number so it displays correctly (sourced from `Cargo.toml`) in Settings.

**Architecture:** Follows the existing `components → hooks → repos → db` layering. A new `notes` SQLite table (single fixed row) is wrapped by `notesRepo.ts`, exposed via `useNote`/`useSaveNote` hooks, and rendered by a new `NotesModal.tsx` (view-rendered-Markdown / click-to-edit-textarea, 12s debounced autosave, flush-on-close). Separately, `tauri.conf.json`'s stale hardcoded version is removed so Tauri derives it from `Cargo.toml`, and `SettingsModal.tsx` displays it via `getVersion()`.

**Tech Stack:** Tauri v2 (`tauri-plugin-sql`, SQLite), React + TypeScript, TanStack Query, Vitest + React Testing Library, `@tauri-apps/api/app`.

## Global Constraints

- Only `data/*Repo.ts` modules may import `db.ts` (architecture rule).
- New React-era modules (`components/*.tsx`, `data/`, `hooks/`) import each other **without** a file extension; reused pre-existing modules (`db`, `utils`, `types`) are imported **with** `.js`.
- New Rust commands must be registered in `tauri::generate_handler![]` in `lib.rs` — not needed for this plan (no new Rust commands).
- Render any user-authored text only through `components/Markdown.tsx` (raw HTML disabled).
- Autosave debounce: 12 seconds (within the spec's 10–15s window).
- Single fixed notes row: `id = 1`. No multi-note support, no history/versioning.
- Package manager: pnpm. Tests: `pnpm test`.

---

### Task 1: Notes table migration

**Files:**
- Create: `src-tauri/migrations/003_notes.sql`
- Modify: `src-tauri/src/lib.rs:9-25` (register migration version 3)

**Interfaces:**
- Produces: SQLite table `notes(id INTEGER PRIMARY KEY, content TEXT NOT NULL DEFAULT '', updated_at TEXT)` with one seeded row `id=1`. Later tasks (`notesRepo.ts`) query/update this row.

- [ ] **Step 1: Create the migration file**

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);

INSERT INTO notes (id, content, updated_at) VALUES (1, '', NULL);
```

Save as `src-tauri/migrations/003_notes.sql`.

- [ ] **Step 2: Register the migration in `lib.rs`**

In `src-tauri/src/lib.rs`, add a third entry to the `vec![...]` passed to `.add_migrations(...)`, right after the version-2 migration:

```rust
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "notes",
                            sql: include_str!("../migrations/003_notes.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
```

- [ ] **Step 3: Verify the Rust side compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors (migration is just a static string include; syntax errors in the SQL only surface at runtime, but this confirms the Rust code itself is valid).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/003_notes.sql src-tauri/src/lib.rs
git commit -m "feat: add notes table migration"
```

---

### Task 2: `notesRepo.ts` data layer

**Files:**
- Create: `src/data/notesRepo.ts`
- Test: `src/__tests__/data/notesRepo.test.ts`

**Interfaces:**
- Consumes: `query<T>(sql, params)`, `execute(sql, params)`, `nowLocalIso()` from `../db.js` / `../utils.js` (both already exist — see `src/data/logEntriesRepo.ts` for the identical pattern).
- Produces: `notesRepo.getNote(): Promise<string>`, `notesRepo.saveNote(content: string): Promise<void>` — consumed by Task 3's hooks.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/data/notesRepo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock, executeMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  executeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({
  query: queryMock,
  execute: executeMock,
}));

import { notesRepo } from '../../data/notesRepo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notesRepo', () => {
  it('getNote returns the stored content', async () => {
    queryMock.mockResolvedValue([{ content: 'hello scribble' }]);
    expect(await notesRepo.getNote()).toBe('hello scribble');
    expect(queryMock).toHaveBeenCalledWith('SELECT content FROM notes WHERE id = 1', []);
  });

  it('getNote returns empty string if no row is found', async () => {
    queryMock.mockResolvedValue([]);
    expect(await notesRepo.getNote()).toBe('');
  });

  it('saveNote updates content and updated_at for row id 1', async () => {
    await notesRepo.saveNote('new text');
    expect(executeMock).toHaveBeenCalledWith(
      'UPDATE notes SET content = ?, updated_at = ? WHERE id = 1',
      ['new text', expect.any(String)]
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/data/notesRepo.test.ts`
Expected: FAIL — `Cannot find module '../../data/notesRepo'`

- [ ] **Step 3: Write the implementation**

Create `src/data/notesRepo.ts`:

```typescript
import { query, execute } from '../db.js';
import { nowLocalIso } from '../utils.js';

/**
 * Repository for the single-row `notes` table (id = 1, no multi-note
 * support). Only this module (besides sibling repos) may import `db.ts`.
 */
export const notesRepo = {
  async getNote(): Promise<string> {
    const rows = await query<{ content: string }>('SELECT content FROM notes WHERE id = 1');
    return rows.length > 0 ? rows[0].content : '';
  },

  async saveNote(content: string): Promise<void> {
    await execute('UPDATE notes SET content = ?, updated_at = ? WHERE id = 1', [
      content,
      nowLocalIso(),
    ]);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/data/notesRepo.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/data/notesRepo.ts src/__tests__/data/notesRepo.test.ts
git commit -m "feat: add notesRepo data layer"
```

---

### Task 3: `useNote` / `useSaveNote` hooks

**Files:**
- Modify: `src/hooks/queryKeys.ts` (add `note` key)
- Create: `src/hooks/useNote.ts`
- Test: `src/__tests__/hooks/useNote.test.tsx`

**Interfaces:**
- Consumes: `notesRepo.getNote()`, `notesRepo.saveNote(content)` from Task 2.
- Produces: `useNote()` → `UseQueryResult<string>`; `useSaveNote()` → `UseMutationResult<void, unknown, string>` — both consumed by `NotesModal.tsx` in Task 4.

- [ ] **Step 1: Add the query key**

In `src/hooks/queryKeys.ts`, add one line inside the exported object (after `settings: ['settings'] as const,`):

```typescript
  note: ['note'] as const,
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/hooks/useNote.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeTestQueryClient } from '../testUtils';

const { getNoteMock, saveNoteMock } = vi.hoisted(() => ({
  getNoteMock: vi.fn(),
  saveNoteMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/notesRepo', () => ({
  notesRepo: { getNote: getNoteMock, saveNote: saveNoteMock },
}));

import { useNote, useSaveNote } from '../../hooks/useNote';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('note hooks', () => {
  it('useNote returns the repo content', async () => {
    getNoteMock.mockResolvedValue('existing text');
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useNote(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('existing text');
  });

  it('useSaveNote calls the repo and invalidates the note query', async () => {
    getNoteMock.mockResolvedValue('old');
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ note: useNote(), save: useSaveNote() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
    expect(getNoteMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.save.mutateAsync('new content');
    });

    expect(saveNoteMock).toHaveBeenCalledWith('new content');
    await waitFor(() => expect(getNoteMock).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/hooks/useNote.test.tsx`
Expected: FAIL — `Cannot find module '../../hooks/useNote'`

- [ ] **Step 4: Write the implementation**

Create `src/hooks/useNote.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesRepo } from '../data/notesRepo';
import { queryKeys } from './queryKeys';

export function useNote() {
  return useQuery({
    queryKey: queryKeys.note,
    queryFn: () => notesRepo.getNote(),
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => notesRepo.saveNote(content),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.note }),
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test src/__tests__/hooks/useNote.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/queryKeys.ts src/hooks/useNote.ts src/__tests__/hooks/useNote.test.tsx
git commit -m "feat: add useNote/useSaveNote hooks"
```

---

### Task 4: Notes modal styles

**Files:**
- Modify: `src/styles.css` (append new rules; do not alter existing `.modal*` rules)

**Interfaces:**
- Produces: CSS classes `.notes-textarea`, `.notes-status`, `.notes-status.error`, `.notes-placeholder` — consumed by `NotesModal.tsx` in Task 5.

- [ ] **Step 1: Append the new rules**

At the end of `src/styles.css`, add:

```css
/* ── Notes modal ── */
.notes-textarea {
  width: 100%;
  min-height: 320px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.notes-textarea:focus {
  outline: none;
  border-color: var(--accent, #888);
}

.notes-placeholder {
  color: var(--text-dim, #888);
  font-style: italic;
  cursor: text;
  padding: 14px;
}

.notes-status {
  font-size: 12px;
  color: var(--text-dim, #888);
  margin-right: auto;
}

.notes-status.error {
  color: var(--danger, #d9534f);
}
```

If `--border`, `--text-dim`, `--accent`, or `--danger` custom properties don't already exist in the file's `:root` block, check `src/styles.css` for the actual dark-theme variable names (`--bg`, `--surface`, `--text`, etc. per CLAUDE.md) and substitute the closest existing ones instead of inventing new custom properties.

- [ ] **Step 2: Sanity-check in the running app**

Run: `pnpm dev` and confirm the app still loads with no CSS parse errors (check browser console). Stop the dev server after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add notes modal styles"
```

---

### Task 5: `NotesModal.tsx` component

**Files:**
- Create: `src/components/NotesModal.tsx`
- Test: `src/__tests__/components/NotesModal.test.tsx`

**Interfaces:**
- Consumes: `useNote()`, `useSaveNote()` from Task 3 (`../../hooks/useNote`); `<Markdown>` from `./Markdown` (props: `children: string`); CSS classes from Task 4.
- Produces: `NotesModal({ onClose }: { onClose: () => void })` — consumed by `App.tsx` in Task 6.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/NotesModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../testUtils';

const { getNoteMock, saveNoteMock } = vi.hoisted(() => ({
  getNoteMock: vi.fn(),
  saveNoteMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/notesRepo', () => ({
  notesRepo: { getNote: getNoteMock, saveNote: saveNoteMock },
}));

import { NotesModal } from '../../components/NotesModal';

beforeEach(() => {
  vi.clearAllMocks();
  getNoteMock.mockResolvedValue('');
});

describe('NotesModal', () => {
  it('shows a placeholder when the note is empty', async () => {
    getNoteMock.mockResolvedValue('');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());
    expect(screen.getByText(/no scribbles yet/i)).toBeTruthy();
  });

  it('renders existing content as Markdown in view mode', async () => {
    getNoteMock.mockResolvedValue('# Hello\n\nSome scribble');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
    );
  });

  it('clicking the rendered view switches to an editable textarea with raw content', async () => {
    getNoteMock.mockResolvedValue('raw **markdown** text');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('raw **markdown** text');
  });

  it('autosaves 12s after the last change, and not before', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getNoteMock.mockResolvedValue('start');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'), { delay: null });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.type(textarea, ' more', { delay: null });

    await vi.advanceTimersByTimeAsync(11000);
    expect(saveNoteMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);
    expect(saveNoteMock).toHaveBeenCalledWith('start more');

    vi.useRealTimers();
  });

  it('flushes a pending unsaved change immediately on close', async () => {
    getNoteMock.mockResolvedValue('start');
    const onClose = vi.fn();
    renderWithProviders(<NotesModal onClose={onClose} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.type(textarea, ' more');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(saveNoteMock).toHaveBeenCalledWith('start more'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/components/NotesModal.test.tsx`
Expected: FAIL — `Cannot find module '../../components/NotesModal'`

- [ ] **Step 3: Write the implementation**

Create `src/components/NotesModal.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { useNote, useSaveNote } from '../hooks/useNote';
import { Markdown } from './Markdown';

export interface NotesModalProps {
  onClose: () => void;
}

const AUTOSAVE_DELAY_MS = 12000;
const SAVED_MESSAGE_DURATION_MS = 3000;

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function NotesModal({ onClose }: NotesModalProps) {
  const { data: content, isSuccess } = useNote();
  const saveNote = useSaveNote();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const lastSavedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef('');

  useEffect(() => {
    if (isSuccess && content !== undefined) {
      setDraft(content);
      draftRef.current = content;
      lastSavedRef.current = content;
    }
  }, [isSuccess, content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        void handleClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function flushSave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (draftRef.current === lastSavedRef.current) return;
    setStatus('saving');
    try {
      await saveNote.mutateAsync(draftRef.current);
      lastSavedRef.current = draftRef.current;
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), SAVED_MESSAGE_DURATION_MS);
    } catch (err) {
      console.error('Failed to save note:', err);
      setStatus('error');
    }
  }

  function handleChange(value: string) {
    setDraft(value);
    draftRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), AUTOSAVE_DELAY_MS);
  }

  async function handleClose() {
    await flushSave();
    onClose();
  }

  return (
    <div
      className="modal-overlay visible"
      id="notesModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) void handleClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Notes</div>
          </div>
          <button className="modal-close" onClick={() => void handleClose()}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {editing ? (
            <textarea
              className="notes-textarea"
              autoFocus
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
            />
          ) : draft === '' ? (
            <div
              className="notes-placeholder"
              data-testid="notes-view"
              onClick={() => setEditing(true)}
            >
              No scribbles yet — click to start writing.
            </div>
          ) : (
            <div data-testid="notes-view" onClick={() => setEditing(true)}>
              <Markdown>{draft}</Markdown>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {status === 'saving' && <span className="notes-status">Saving…</span>}
          {status === 'saved' && <span className="notes-status">Saved</span>}
          {status === 'error' && (
            <span className="notes-status error">Save failed — will retry</span>
          )}
          <button className="btn-ghost" onClick={() => void handleClose()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/components/NotesModal.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/NotesModal.tsx src/__tests__/components/NotesModal.test.tsx
git commit -m "feat: add NotesModal with view/edit toggle and debounced autosave"
```

---

### Task 6: Wire Notes into `App.tsx`

**Files:**
- Modify: `src/app/App.tsx:5-21` (import, `ModalState`), `:97-107` (header actions), `:122-131` (modal render)

**Interfaces:**
- Consumes: `NotesModal` from Task 5 (`../components/NotesModal`, props `{ onClose: () => void }`).

- [ ] **Step 1: Add the import**

In `src/app/App.tsx`, add alongside the other component imports (after the `ArchiveModal` import on line 11):

```typescript
import { NotesModal } from '../components/NotesModal';
```

- [ ] **Step 2: Extend `ModalState`**

Change the `ModalState` type (currently lines 17-21) to add a `'notes'` variant:

```typescript
type ModalState =
  | { kind: 'none' }
  | { kind: 'log'; day: string | null }
  | { kind: 'settings' }
  | { kind: 'archive' }
  | { kind: 'notes' };
```

- [ ] **Step 3: Add the header button**

In the `header-actions` div (around line 97-107), add a new button right after "View Log" and before "Export .md":

```typescript
          <button className="btn-ghost" id="viewLogBtn" onClick={() => setModal({ kind: 'log', day: null })}>
            ⊞ View Log
          </button>
          <button className="btn-ghost" id="notesBtn" onClick={() => setModal({ kind: 'notes' })}>
            📝 Notes
          </button>
```

- [ ] **Step 4: Render the modal**

After the `ArchiveModal` block (around line 126-131), add:

```typescript
      {modal.kind === 'notes' && <NotesModal onClose={() => setModal({ kind: 'none' })} />}
```

- [ ] **Step 5: Manually verify in the running app**

Run: `pnpm tauri dev`
- Click "📝 Notes" in the header → modal opens showing the empty-state placeholder.
- Click the placeholder → textarea appears; type some text.
- Wait ~12s → footer briefly shows "Saving…" then "Saved".
- Close and reopen the modal → typed text is still there, rendered as Markdown.
- Press Escape while the modal is open → it closes.

Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: wire Notes modal into the app header"
```

---

### Task 7: Fix version drift and display it in Settings

**Files:**
- Modify: `src-tauri/tauri.conf.json:4` (remove hardcoded `version`)
- Modify: `src/components/SettingsModal.tsx:1-2` (import), `:17-29` (load effect), `:70-156` (render footer)
- Test: `src/__tests__/components/SettingsModal.test.tsx` (extend)

**Interfaces:**
- Consumes: `getVersion()` from `@tauri-apps/api/app` (already-installed dependency, no package changes needed).

- [ ] **Step 1: Remove the stale hardcoded version from `tauri.conf.json`**

In `src-tauri/tauri.conf.json`, delete line 4 (`"version": "1.1.0",`) entirely. The file's `app` section is unaffected. Tauri will now read the version from `src-tauri/Cargo.toml`'s `package.version` field (currently `1.4.0`) at build time.

- [ ] **Step 2: Verify the Rust side still builds**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors.

- [ ] **Step 3: Write the failing test**

In `src/__tests__/components/SettingsModal.test.tsx`, add to the `vi.hoisted` block (merge with the existing one at the top of the file) a `getVersionMock`, mock the module, and add a new test. The updated top of the file:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../testUtils';

const {
  getChatDaysMock,
  getMock,
  getLLMConfigMock,
  saveLLMConfigMock,
  clearLLMConfigMock,
  setChatDaysMock,
  getAdapterMock,
  runLLMMigrationMock,
  getVersionMock,
} = vi.hoisted(() => ({
  getChatDaysMock: vi.fn().mockResolvedValue(3),
  getMock: vi.fn().mockResolvedValue('3'),
  getLLMConfigMock: vi.fn().mockResolvedValue({ provider: 'anthropic', apiKey: '', model: '', baseUrl: '' }),
  saveLLMConfigMock: vi.fn().mockResolvedValue(undefined),
  clearLLMConfigMock: vi.fn().mockResolvedValue(undefined),
  setChatDaysMock: vi.fn().mockResolvedValue(undefined),
  getAdapterMock: vi.fn().mockResolvedValue(null),
  runLLMMigrationMock: vi.fn().mockResolvedValue(undefined),
  getVersionMock: vi.fn().mockResolvedValue('1.4.0'),
}));

vi.mock('../../data/settingsRepo', () => ({
  settingsRepo: {
    getChatDays: getChatDaysMock,
    setChatDays: setChatDaysMock,
    get: getMock,
    getLLMConfig: getLLMConfigMock,
    saveLLMConfig: saveLLMConfigMock,
    clearLLMConfig: clearLLMConfigMock,
  },
}));

vi.mock('../../llm/factory.js', () => ({
  getAdapter: getAdapterMock,
  runLLMMigration: runLLMMigrationMock,
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: getVersionMock,
}));

import { SettingsModal } from '../../components/SettingsModal';

beforeEach(() => {
  vi.clearAllMocks();
  getChatDaysMock.mockResolvedValue(3);
  getMock.mockResolvedValue('3');
  getLLMConfigMock.mockResolvedValue({ provider: 'anthropic', apiKey: '', model: '', baseUrl: '' });
  getVersionMock.mockResolvedValue('1.4.0');
});
```

Then add a new test inside the existing `describe('SettingsModal', ...)` block (alongside the other `it(...)` calls):

```typescript
  it('displays the app version from getVersion()', async () => {
    renderWithProviders(<SettingsModal onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('v1.4.0')).toBeTruthy());
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test src/__tests__/components/SettingsModal.test.tsx`
Expected: FAIL — `Unable to find an element with the text: v1.4.0`

- [ ] **Step 5: Implement the version display**

In `src/components/SettingsModal.tsx`:

Add the import (after line 2, alongside the other imports):

```typescript
import { getVersion } from '@tauri-apps/api/app';
```

Add a new state variable inside the component (after the existing `useState` declarations, e.g. after `chatDaysInput`):

```typescript
  const [appVersion, setAppVersion] = useState('');
```

Extend the existing load effect (currently lines 17-29) to also fetch the version — change it to:

```typescript
  useEffect(() => {
    void (async () => {
      const [cfg, days, version] = await Promise.all([
        settingsRepo.getLLMConfig(),
        settingsRepo.get('chat_days'),
        getVersion(),
      ]);
      setProvider(cfg.provider ?? 'anthropic');
      setApiKey(cfg.apiKey ?? '');
      setModel(cfg.model ?? '');
      setBaseUrl(cfg.baseUrl ?? '');
      setChatDaysInput(days ?? '3');
      setAppVersion(version);
    })();
  }, []);
```

Add the footer text at the end of `.modal-body.settings-body`, right after the "Save" button (before the closing `</div>` of `modal-body`, i.e. after line 151's `</button>`):

```typescript
          <p className="settings-hint" id="appVersionText">
            v{appVersion}
          </p>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test src/__tests__/components/SettingsModal.test.tsx`
Expected: PASS (all tests, including the new one)

- [ ] **Step 7: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass, no regressions.

- [ ] **Step 8: Manually verify in the running app**

Run: `pnpm tauri dev`
- Open Settings → footer shows `v1.4.0` (matching `src-tauri/Cargo.toml`'s `version`).

Stop the dev server after confirming.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/tauri.conf.json src/components/SettingsModal.tsx src/__tests__/components/SettingsModal.test.tsx
git commit -m "fix: source app version from Cargo.toml and display it in Settings"
```
