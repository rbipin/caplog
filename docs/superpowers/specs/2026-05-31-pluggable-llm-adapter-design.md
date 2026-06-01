# Pluggable LLM Adapter Design

**Date:** 2026-05-31
**Status:** Approved

## Goal

Make the LLM API call pluggable so the user can switch between AI providers (Anthropic, OpenAI-compatible endpoints, Ollama, etc.) from the Settings panel without changing code.

---

## Architecture

A new `src/llm/` folder holds all adapter code, isolated from the rest of the app:

```
src/
  llm/
    adapter.ts      ← LLMAdapter interface
    anthropic.ts    ← AnthropicAdapter class
    openai.ts       ← OpenAIAdapter class (covers any OpenAI-compatible endpoint)
    factory.ts      ← getAdapter() — reads settings, returns active adapter or null
  ai.ts             ← updated: formatLogEntry accepts LLMAdapter instead of apiKey string
  main.ts           ← updated: calls getAdapter(), passes result to formatLogEntry
```

### Interface

```typescript
interface LLMAdapter {
  complete(system: string, user: string): Promise<string>;
}
```

The adapter is a thin transport layer. It receives a system prompt and user message, makes the API call, and returns the raw text response. It does not construct prompts or parse HTML — that stays in `ai.ts`.

### formatLogEntry signature change

```typescript
// Before
async function formatLogEntry(rawText: string, apiKey: string): Promise<string>

// After
async function formatLogEntry(rawText: string, adapter: LLMAdapter): Promise<string>
```

`formatLogEntry` keeps the system prompt string and the HTML wrapping of the response. It delegates the actual API call to `adapter.complete(system, rawText)`.

### Call sites in main.ts

Replace:
```typescript
const apiKey = await getSetting('anthropic_api_key');
if (apiKey) { formatted = await formatLogEntry(value, apiKey); }
```

With:
```typescript
const adapter = await getAdapter();
if (adapter) { formatted = await formatLogEntry(value, adapter); }
```

---

## Adapter Classes

### AnthropicAdapter

Wraps the current `ai.ts` fetch logic against `https://api.anthropic.com/v1/messages`.

Constructor config:
```typescript
{ apiKey: string; model: string }
```

Default model: `claude-haiku-4-5-20251001`.

### OpenAIAdapter

Uses the `/v1/chat/completions` schema. Works with OpenAI, Ollama, Groq, Together, and any compatible endpoint.

Constructor config:
```typescript
{ apiKey: string; baseUrl: string; model: string }
```

Example base URLs:
- OpenAI: `https://api.openai.com`
- Ollama: `http://localhost:11434`

---

## Settings Schema

The single `anthropic_api_key` DB key is replaced by four keys:

| Key | Values / Example |
|---|---|
| `llm_provider` | `anthropic` \| `openai` |
| `llm_api_key` | `sk-ant-...` or OpenAI key |
| `llm_model` | `claude-haiku-4-5-20251001`, `gpt-4o`, `llama3`, etc. |
| `llm_base_url` | Required for `openai` provider only |

### Migration

On first `getAdapter()` call, if `anthropic_api_key` exists and `llm_provider` does not:
1. Write `llm_provider = anthropic`, `llm_api_key = <old value>`, `llm_model = claude-haiku-4-5-20251001`
2. Delete `anthropic_api_key`

The old key is only deleted after new keys are successfully written. If anything fails, `getAdapter()` returns `null` and retries on the next launch.

---

## Settings UI Changes

The Settings panel gains three new fields alongside the API key input:

- **Provider** — dropdown: `Anthropic` / `OpenAI-compatible`
- **Model** — text input (e.g. `claude-haiku-4-5-20251001`)
- **Base URL** — text input, only visible when `OpenAI-compatible` is selected

The existing API key field is relabeled to just "API Key" (provider-agnostic).

All four values are saved/loaded together. The save path writes all four keys atomically (sequential `setSetting` calls — same as today). The load path reads all four on `SettingsModal.open()`.

**Clearing settings:** If the API key field is empty on save, all four `llm_*` keys are deleted from the DB (same behaviour as the current empty-key delete for `anthropic_api_key`). This leaves the app with no configured provider — AI formatting is skipped until the user reconfigures.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No provider configured (`getAdapter()` → `null`) | Skip AI formatting, save raw text. No error shown. |
| `openai` provider with missing base URL | `getAdapter()` returns `null`, logs console warning. |
| API call fails / bad credentials | `adapter.complete()` throws. Existing `try/catch` in `main.ts` catches it, falls back to raw text. No call-site changes needed. |
| Migration write fails mid-flight | `getAdapter()` returns `null` for this launch. Retries next launch. Old key preserved until new keys are confirmed written. |
