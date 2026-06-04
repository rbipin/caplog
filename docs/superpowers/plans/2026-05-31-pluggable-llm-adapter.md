# Pluggable LLM Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Completed

**Goal:** Replace the hardcoded Anthropic fetch in `src/ai.ts` with a class-based adapter pattern so any LLM provider (Anthropic, OpenAI-compatible, Ollama, etc.) can be configured from the Settings panel.

**Architecture:** A new `src/llm/` folder holds a `LLMAdapter` interface, two concrete adapter classes (`AnthropicAdapter`, `OpenAIAdapter`), and a `getAdapter()` factory that reads four new DB settings keys and returns the active adapter (or `null` if unconfigured). `formatLogEntry` in `ai.ts` changes its second argument from `apiKey: string` to `adapter: LLMAdapter`. The Settings modal grows a provider dropdown, model field, and (conditionally) a base URL field.

**Tech Stack:** TypeScript, Tauri v2, `@tauri-apps/plugin-sql` (SQLite via `src/db.ts`), `fetch` API

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/llm/adapter.ts` | Create | `LLMAdapter` interface |
| `src/llm/anthropic.ts` | Create | `AnthropicAdapter` class |
| `src/llm/openai.ts` | Create | `OpenAIAdapter` class |
| `src/llm/factory.ts` | Create | `getAdapter()` factory + migration |
| `src/ai.ts` | Modify | Accept `LLMAdapter` instead of `apiKey` |
| `src/main.ts` | Modify | Call sites + `SettingsModal` class |
| `index.html` | Modify | New settings modal fields |
| `src/styles.css` | Modify | Style for `<select>` element |

---

## Task 1: LLMAdapter interface

**Files:**
- Create: `src/llm/adapter.ts`

- [ ] **Step 1.1: Create `src/llm/adapter.ts`**

```typescript
export interface LLMAdapter {
  complete(system: string, user: string): Promise<string>;
}
```

- [ ] **Step 1.2: Verify build passes**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 1.3: Commit**

```bash
git add src/llm/adapter.ts
git commit -m "feat: add LLMAdapter interface"
```

---

## Task 2: AnthropicAdapter

**Files:**
- Create: `src/llm/anthropic.ts`

Wraps the existing Anthropic fetch logic from `src/ai.ts`.

- [ ] **Step 2.1: Create `src/llm/anthropic.ts`**

```typescript
import { LLMAdapter } from './adapter.js';

export class AnthropicAdapter implements LLMAdapter {
  constructor(private apiKey: string, private model: string) {}

  async complete(system: string, user: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) throw new Error('Empty response from Anthropic API');
    return (text as string).trim();
  }
}
```

- [ ] **Step 2.2: Verify build passes**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/llm/anthropic.ts
git commit -m "feat: add AnthropicAdapter"
```

---

## Task 3: OpenAIAdapter

**Files:**
- Create: `src/llm/openai.ts`

Supports any endpoint that speaks the `/v1/chat/completions` schema (OpenAI, Ollama, Groq, Together, etc.).

- [ ] **Step 3.1: Create `src/llm/openai.ts`**

```typescript
import { LLMAdapter } from './adapter.js';

export class OpenAIAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  async complete(system: string, user: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI-compatible API error ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from API');
    return (text as string).trim();
  }
}
```

- [ ] **Step 3.2: Verify build passes**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/llm/openai.ts
git commit -m "feat: add OpenAIAdapter"
```

---

## Task 4: getAdapter factory + migration

**Files:**
- Create: `src/llm/factory.ts`

Reads the four `llm_*` DB keys, migrates from the old `anthropic_api_key` key on first run, and returns the active adapter (or `null`).

DB keys used:
- `llm_provider` — `'anthropic'` | `'openai'`
- `llm_api_key` — the API key string
- `llm_model` — model name (default `'claude-haiku-4-5-20251001'` for Anthropic)
- `llm_base_url` — base URL, required only for `openai` provider

Migration logic: if `anthropic_api_key` exists in DB and `llm_provider` does not, write all three new keys and delete the old one. Only delete the old key after all new keys are confirmed written.

- [ ] **Step 4.1: Create `src/llm/factory.ts`**

```typescript
import { getSetting, setSetting, execute } from '../db.js';
import { LLMAdapter } from './adapter.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export async function getAdapter(): Promise<LLMAdapter | null> {
  const oldKey = await getSetting('anthropic_api_key');
  let provider = await getSetting('llm_provider');

  if (oldKey && !provider) {
    try {
      await setSetting('llm_provider', 'anthropic');
      await setSetting('llm_api_key', oldKey);
      await setSetting('llm_model', DEFAULT_ANTHROPIC_MODEL);
      await execute('DELETE FROM settings WHERE key = ?', ['anthropic_api_key']);
      provider = 'anthropic';
    } catch {
      console.warn('LLM settings migration failed — will retry next launch');
      return null;
    }
  }

  if (!provider) return null;

  const apiKey = await getSetting('llm_api_key');
  if (!apiKey) return null;

  const model = (await getSetting('llm_model')) || DEFAULT_ANTHROPIC_MODEL;

  if (provider === 'anthropic') {
    return new AnthropicAdapter(apiKey, model);
  }

  if (provider === 'openai') {
    const baseUrl = await getSetting('llm_base_url');
    if (!baseUrl) {
      console.warn('llm_provider=openai but llm_base_url is not set');
      return null;
    }
    return new OpenAIAdapter(apiKey, baseUrl, model);
  }

  return null;
}
```

- [ ] **Step 4.2: Verify build passes**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/llm/factory.ts
git commit -m "feat: add getAdapter factory with migration from anthropic_api_key"
```

---

## Task 5: Update src/ai.ts

**Files:**
- Modify: `src/ai.ts`

Change `formatLogEntry` to accept a `LLMAdapter` instead of an `apiKey` string. The system prompt and response trimming stay here; the transport moves to the adapter.

- [ ] **Step 5.1: Replace the contents of `src/ai.ts`**

```typescript
import { LLMAdapter } from './llm/adapter.js';

const SYSTEM_PROMPT = 'Clean up and format the user\'s text into concise bullet points. Fix typos, capitalize properly, remove filler words. Return only the bullet points as HTML <ul><li>...</li></ul> with no preamble or explanation.';

export async function formatLogEntry(rawText: string, adapter: LLMAdapter): Promise<string> {
  const text = await adapter.complete(SYSTEM_PROMPT, rawText);
  return text.trim();
}
```

- [ ] **Step 5.2: Verify build passes**

```bash
pnpm build
```

Expected: TypeScript will now error on the two call sites in `main.ts` that still pass `apiKey: string`. That is expected — they will be fixed in Task 6.

- [ ] **Step 5.3: Commit**

```bash
git add src/ai.ts
git commit -m "refactor: formatLogEntry accepts LLMAdapter instead of apiKey"
```

---

## Task 6: Update call sites in main.ts

**Files:**
- Modify: `src/main.ts`

Two call sites use `formatLogEntry(value, apiKey)`:
1. `App.handleInput` (log entry branch) — around line 635
2. `ChatArea.startEdit` (save handler) — around line 335

Both follow the same pattern: `getSetting('anthropic_api_key')` → check truthy → call `formatLogEntry`. Replace with `getAdapter()` → check non-null → call `formatLogEntry`.

- [ ] **Step 6.1: Add import for getAdapter at the top of src/main.ts**

Find the existing imports at the top of `src/main.ts`:
```typescript
import { initDB, query, execute, getSetting, setSetting } from './db.js';
import { formatLogEntry } from './ai.js';
import { exportMarkdown } from './export.js';
```

Add `getAdapter` import:
```typescript
import { initDB, query, execute, getSetting, setSetting } from './db.js';
import { formatLogEntry } from './ai.js';
import { exportMarkdown } from './export.js';
import { getAdapter } from './llm/factory.js';
```

- [ ] **Step 6.2: Update the call site in App.handleInput (log entry branch)**

Find this block (in the `else` branch of `handleInput`):
```typescript
const apiKey = await getSetting('anthropic_api_key');

let formatted = `<ul><li>${escapeHtml(value)}</li></ul>`;

if (apiKey) {
  this.inputHandler.setLoading(true);
  try {
    formatted = await formatLogEntry(value, apiKey);
```

Replace with:
```typescript
const adapter = await getAdapter();

let formatted = `<ul><li>${escapeHtml(value)}</li></ul>`;

if (adapter) {
  this.inputHandler.setLoading(true);
  try {
    formatted = await formatLogEntry(value, adapter);
```

- [ ] **Step 6.3: Update the call site in ChatArea.startEdit (save handler)**

Find this block (inside the save button click handler in `startEdit`):
```typescript
const apiKey = await getSetting('anthropic_api_key');
let formatted = `<ul><li>${escapeHtml(newText)}</li></ul>`;

if (apiKey) {
  try {
    formatted = await formatLogEntry(newText, apiKey);
```

Replace with:
```typescript
const adapter = await getAdapter();
let formatted = `<ul><li>${escapeHtml(newText)}</li></ul>`;

if (adapter) {
  try {
    formatted = await formatLogEntry(newText, adapter);
```

- [ ] **Step 6.4: Verify build passes with no errors**

```bash
pnpm build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 6.5: Commit**

```bash
git add src/main.ts
git commit -m "refactor: replace apiKey string with getAdapter() at call sites"
```

---

## Task 7: Update index.html settings modal

**Files:**
- Modify: `index.html`

Add a provider dropdown, model field, and base URL field (hidden by default) to the settings modal. The base URL field is revealed only when the `openai` provider is selected. Relabel the API key field to just "API Key".

- [ ] **Step 7.1: Replace the settings modal body in index.html**

Find the `<div class="modal-body settings-body">` block (currently contains label, apiKeyInput, hint, save button) and replace its entire contents:

```html
<div class="modal-body settings-body">
  <label class="settings-label">Provider</label>
  <select id="llmProviderSelect" class="settings-select">
    <option value="anthropic">Anthropic</option>
    <option value="openai">OpenAI-compatible</option>
  </select>

  <label class="settings-label">API Key</label>
  <input
    type="password"
    id="apiKeyInput"
    class="settings-input"
    placeholder="sk-..."
  />

  <label class="settings-label">Model</label>
  <input
    type="text"
    id="llmModelInput"
    class="settings-input"
    placeholder="claude-haiku-4-5-20251001"
  />

  <div id="baseUrlGroup">
    <label class="settings-label">Base URL</label>
    <input
      type="text"
      id="llmBaseUrlInput"
      class="settings-input"
      placeholder="https://api.openai.com"
    />
    <p class="settings-hint">For Ollama use http://localhost:11434</p>
  </div>

  <p class="settings-hint">Used for AI log formatting. Stored locally, never sent anywhere else.</p>
  <button id="saveSettingsBtn" class="settings-save-btn">Save</button>
</div>
```

- [ ] **Step 7.2: Verify build passes**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
git add index.html
git commit -m "feat: add provider, model, base URL fields to settings modal"
```

---

## Task 8: Update SettingsModal class and add select styles

**Files:**
- Modify: `src/main.ts` — `SettingsModal` class
- Modify: `src/styles.css` — add `.settings-select` style

The `SettingsModal` class needs to:
1. Wire up the new elements on construction
2. Show/hide `#baseUrlGroup` based on provider dropdown value
3. Load all four `llm_*` settings on `open()`
4. Save all four on `save()`, or delete all four if API key is empty

- [ ] **Step 8.1: Add `.settings-select` to src/styles.css**

Append to `src/styles.css`:

```css
.settings-select {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 15px;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
}

.settings-select:focus {
  outline: none;
  border-color: var(--accent);
}
```

- [ ] **Step 8.2: Replace the SettingsModal class in src/main.ts**

Find and replace the entire `SettingsModal` class with:

```typescript
class SettingsModal {
  private overlay: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private baseUrlInput: HTMLInputElement;
  private baseUrlGroup: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.providerSelect = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.modelInput = document.getElementById('llmModelInput') as HTMLInputElement;
    this.baseUrlInput = document.getElementById('llmBaseUrlInput') as HTMLInputElement;
    this.baseUrlGroup = document.getElementById('baseUrlGroup')!;

    document.getElementById('settingsCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.getElementById('saveSettingsBtn')!.addEventListener('click', () => { void this.save(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.close(); });

    this.providerSelect.addEventListener('change', () => this.syncBaseUrlVisibility());
  }

  private syncBaseUrlVisibility(): void {
    this.baseUrlGroup.style.display = this.providerSelect.value === 'openai' ? 'block' : 'none';
  }

  async open(): Promise<void> {
    const [provider, apiKey, model, baseUrl] = await Promise.all([
      getSetting('llm_provider'),
      getSetting('llm_api_key'),
      getSetting('llm_model'),
      getSetting('llm_base_url'),
    ]);

    this.providerSelect.value = provider ?? 'anthropic';
    this.apiKeyInput.value = apiKey ?? '';
    this.modelInput.value = model ?? '';
    this.baseUrlInput.value = baseUrl ?? '';
    this.syncBaseUrlVisibility();
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  private async save(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      await Promise.all([
        execute('DELETE FROM settings WHERE key = ?', ['llm_provider']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_api_key']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_model']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_base_url']),
      ]);
      this.close();
      return;
    }

    const provider = this.providerSelect.value;
    const model = this.modelInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();

    await setSetting('llm_provider', provider);
    await setSetting('llm_api_key', apiKey);
    await setSetting('llm_model', model);
    await setSetting('llm_base_url', provider === 'openai' ? baseUrl : '');

    this.close();
  }
}
```

- [ ] **Step 8.3: Verify build passes**

```bash
pnpm build
```

Expected: clean build, no errors.

- [ ] **Step 8.4: Run the app and manually test**

```bash
pnpm tauri dev
```

Manual tests:
1. Open Settings — provider dropdown shows "Anthropic" by default, base URL field is hidden
2. Switch to "OpenAI-compatible" — base URL field appears
3. Switch back to "Anthropic" — base URL field hides again
4. Enter an Anthropic API key, click Save, reopen Settings — key is populated
5. Clear the API key field, click Save — all provider settings are cleared; reopen Settings shows empty fields
6. With Anthropic configured: type a log entry — AI formatting runs as before
7. Switch provider to OpenAI-compatible, enter a valid OpenAI base URL and key, type a log entry — formatted via OpenAI

- [ ] **Step 8.5: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat: update SettingsModal to support pluggable LLM provider"
```

---

## Milestone Summary

| Task | Deliverable | Status |
|---|---|---|
| 1 — Interface | `LLMAdapter` interface defined | - [ ] |
| 2 — AnthropicAdapter | Anthropic fetch wrapped in class | - [ ] |
| 3 — OpenAIAdapter | OpenAI-compatible fetch in class | - [ ] |
| 4 — Factory | `getAdapter()` with migration | - [ ] |
| 5 — ai.ts | `formatLogEntry` accepts adapter | - [ ] |
| 6 — Call sites | `main.ts` uses `getAdapter()` | - [ ] |
| 7 — HTML | Settings modal has new fields | - [ ] |
| 8 — SettingsModal | Class handles new fields + save/load | - [ ] |
