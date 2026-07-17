# Design: Notepad Scribble Note + App Version Display

**Date:** 2026-07-16

## Problem

Users want a place for undated, plain-text scribbles — separate from the dated daily log — that autosaves so nothing is lost. Separately, the app's version is currently inconsistent (`Cargo.toml` says `1.4.0`, `tauri.conf.json` hardcodes a stale `1.1.0`) and isn't shown anywhere in the UI.

## Scope

1. A single, fixed scratchpad note (no titles, no list, no history/versioning) accessible from the header, with view (rendered Markdown) / click-to-edit (raw textarea) modes and autosave.
2. Display the app version (sourced from `Cargo.toml` at build time) in the Settings modal footer.

These are two small, independent changes bundled in one spec because they touch adjacent areas (header, Settings modal) and are small enough not to warrant separate specs.

---

## Part 1: Notes

### Data Model

New migration `src-tauri/migrations/003_notes.sql`:

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);

INSERT INTO notes (id, content, updated_at) VALUES (1, '', NULL);
```

Single fixed row (`id = 1`). No multi-note support — out of scope (YAGNI).

### Repo (`src/data/notesRepo.ts`)

- `getNote(): Promise<string>` — `SELECT content FROM notes WHERE id = 1`
- `saveNote(content: string): Promise<void>` — `UPDATE notes SET content = ?, updated_at = ? WHERE id = 1`

Only this repo imports `db.ts` for note data, per the architecture rule.

### Hooks (`src/hooks/useNote.ts`)

- `useNote()` — `useQuery(['note'], notesRepo.getNote)`
- `useSaveNote()` — `useMutation(notesRepo.saveNote)`, invalidates `['note']` on success

### Component (`src/components/NotesModal.tsx`)

Overlay modal, styled consistent with `LogModal`/`SettingsModal`.

- **View mode (default):** renders `content` through the shared `<Markdown>` component. If `content === ''`, shows placeholder text: *"No scribbles yet — click to start writing."*
- **Click anywhere in the rendered area** → switches to edit mode: a plain, autofocused `<textarea>` pre-filled with the raw content.
- **Autosave:** every keystroke resets a 12-second debounce timer. When the timer fires and content differs from the last-saved value, call `useSaveNote().mutate(content)`.
  - Footer status text: `Saving…` while the mutation is in flight, then `Saved` for ~3s, then clears.
  - On mutation failure: footer shows `Save failed — will retry` (transient, non-blocking); the textarea content is never discarded, and the debounce timer restarts so the next edit (or a manual retry on close) attempts the save again.
- **Close (✕ or click-outside):** flushes any pending unsaved change synchronously (awaits the save) before closing, so edits made within the last debounce window aren't lost.
- No Markdown toolbar, no formatting UI — user types raw Markdown/plain text directly.

### Wiring (`src/app/App.tsx`)

- Add `{ kind: 'notes' }` to `ModalState`.
- Add a header button next to "View Log": `📝 Notes` → `setModal({ kind: 'notes' })`.
- Render `<NotesModal onClose={() => setModal({ kind: 'none' })} />` when `modal.kind === 'notes'`.

### Testing

| Layer | Tests |
|---|---|
| `notesRepo` | `getNote` returns content; `saveNote` issues correct UPDATE (mocks `db.js`) |
| `useNote` / `useSaveNote` | query returns repo value; mutation calls repo and invalidates `['note']` (mock repo) |
| `NotesModal` | renders content via Markdown in view mode; empty content shows placeholder; click switches to textarea with raw content; debounced autosave fires after timer elapses with changed content; no save fires if content unchanged; close flushes pending save; save-failure shows footer message without losing textarea content |

---

## Part 2: App Version Display

### Fix version drift

Remove the hardcoded `"version": "1.1.0"` field from `src-tauri/tauri.conf.json`. Per Tauri's documented behavior, omitting `version` makes Tauri fall back to reading it from `src-tauri/Cargo.toml` (`package.version`), making Cargo.toml the single source of truth going forward.

### Display

- `SettingsModal.tsx` calls `getVersion()` from `@tauri-apps/api/app` (Tauri's built-in API) on mount, storing the result in local state.
- Rendered as small, muted footer text in the Settings modal, e.g. `v1.4.0`.
- No new Rust command, no migration.

### Testing

- `SettingsModal` test: mock `@tauri-apps/api/app`'s `getVersion()`, assert the returned version string renders in the footer.

---

## Files Changed

| File | Change |
|---|---|
| `src-tauri/migrations/003_notes.sql` | New migration: `notes` table, single seeded row |
| `src/data/notesRepo.ts` | New: `getNote`, `saveNote` |
| `src/hooks/useNote.ts` | New: `useNote`, `useSaveNote` |
| `src/components/NotesModal.tsx` | New: view/edit modal with debounced autosave |
| `src/app/App.tsx` | Add `'notes'` modal state, header button, render `NotesModal` |
| `src-tauri/tauri.conf.json` | Remove hardcoded stale `"version"` field |
| `src/components/SettingsModal.tsx` | Add version footer text via `getVersion()` |
| `src/__tests__/data/notesRepo.test.ts` | New |
| `src/__tests__/hooks/useNote.test.ts` | New |
| `src/__tests__/components/NotesModal.test.tsx` | New |
| `src/__tests__/components/SettingsModal.test.tsx` | Extend with version-display test |
