import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const { executeMock, queryMock, getSettingMock, setSettingMock } = vi.hoisted(() => ({
  executeMock: vi.fn().mockResolvedValue(undefined),
  queryMock: vi.fn().mockResolvedValue([]),
  getSettingMock: vi.fn().mockResolvedValue(null),
  setSettingMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  query: queryMock,
  execute: executeMock,
  getSetting: getSettingMock,
  setSetting: setSettingMock,
}));
vi.mock('../../llm/factory.js', () => ({ getAdapter: vi.fn().mockResolvedValue(null) }));
vi.mock('../../export.js', () => ({ exportMarkdown: vi.fn() }));

const FULL_DOM = `<div id="app">
  <div id="sidebarMonthLabel"></div><div id="dayList"></div>
  <div id="chatArea"></div>
  <div id="todoList"></div><div id="todoCount"></div>
  <div id="headerDate"></div>
  <textarea id="chatInput"></textarea><button id="sendBtn">Send</button>
  <button id="sidebarToggleBtn"></button><button id="viewLogBtn"></button>
  <button id="settingsBtn"></button><button id="exportBtn"></button>
  <div id="logModal"><div id="modalSubtitle"></div><div id="modalBody"></div>
    <button id="modalCloseBtn"></button><button id="modalFooterCloseBtn"></button></div>
  <div id="settingsModal">
    <select id="llmProviderSelect"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
    <input id="apiKeyInput" /><input id="llmModelInput" /><input id="llmBaseUrlInput" />
    <div id="baseUrlGroup"></div><input id="chatDaysInput" type="number" /><button id="settingsCloseBtn"></button><button id="saveSettingsBtn"></button>
  </div>
</div>`;

function resetInputs() {
  (document.getElementById('apiKeyInput') as HTMLInputElement).value = '';
  (document.getElementById('llmModelInput') as HTMLInputElement).value = '';
  (document.getElementById('llmBaseUrlInput') as HTMLInputElement).value = '';
  (document.getElementById('llmProviderSelect') as HTMLSelectElement).value = 'anthropic';
  document.getElementById('settingsModal')!.classList.remove('visible');
}

async function openSettings() {
  document.getElementById('settingsBtn')!.click();
  await new Promise(r => setTimeout(r, 30));
}

describe('SettingsModal', () => {
  beforeAll(async () => {
    document.body.innerHTML = FULL_DOM;
    await import('../../app.js');
    window.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(r => setTimeout(r, 100));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockResolvedValue(undefined);
    setSettingMock.mockResolvedValue(undefined);
    getSettingMock.mockResolvedValue(null);
    queryMock.mockResolvedValue([]);
    resetInputs();
  });

  it('open() reads all five settings from db and populates inputs', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'llm_provider') return 'anthropic';
      if (key === 'llm_api_key') return 'sk-test-key';
      if (key === 'llm_model') return 'claude-haiku-4-5-20251001';
      if (key === 'llm_base_url') return '';
      if (key === 'chat_days') return '5';
      return null;
    });

    await openSettings();

    expect((document.getElementById('apiKeyInput') as HTMLInputElement).value).toBe('sk-test-key');
    expect((document.getElementById('llmModelInput') as HTMLInputElement).value).toBe('claude-haiku-4-5-20251001');
    expect((document.getElementById('llmProviderSelect') as HTMLSelectElement).value).toBe('anthropic');
    expect((document.getElementById('chatDaysInput') as HTMLInputElement).value).toBe('5');
  });

  it('base-URL group is hidden when provider is anthropic', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'llm_provider') return 'anthropic';
      return null;
    });

    await openSettings();

    expect((document.getElementById('baseUrlGroup') as HTMLElement).style.display).toBe('none');
  });

  it('base-URL group is visible when provider is openai', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'llm_provider') return 'openai';
      return null;
    });

    await openSettings();

    expect((document.getElementById('baseUrlGroup') as HTMLElement).style.display).toBe('block');
  });

  it('save() with empty API key deletes all five setting rows', async () => {
    await openSettings();
    // apiKeyInput is empty (reset in beforeEach)
    document.getElementById('saveSettingsBtn')!.click();
    await new Promise(r => setTimeout(r, 30));

    const deleteCalls = executeMock.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM settings'));
    expect(deleteCalls.length).toBe(5);
  });

  it('save() with valid inputs writes provider, key, model, baseUrl, and chat_days to db', async () => {
    await openSettings();
    (document.getElementById('apiKeyInput') as HTMLInputElement).value = 'sk-valid-key';
    (document.getElementById('llmModelInput') as HTMLInputElement).value = 'claude-haiku-4-5-20251001';
    (document.getElementById('chatDaysInput') as HTMLInputElement).value = '7';

    document.getElementById('saveSettingsBtn')!.click();
    await new Promise(r => setTimeout(r, 30));

    expect(setSettingMock).toHaveBeenCalledWith('llm_api_key', 'sk-valid-key');
    expect(setSettingMock).toHaveBeenCalledWith('llm_model', 'claude-haiku-4-5-20251001');
    expect(setSettingMock).toHaveBeenCalledWith('llm_provider', 'anthropic');
    expect(setSettingMock).toHaveBeenCalledWith('chat_days', '7');
  });

  it('save() with missing model name calls alert and does not close modal', async () => {
    const alertMock = vi.fn();
    const original = window.alert;
    window.alert = alertMock;

    await openSettings();
    (document.getElementById('apiKeyInput') as HTMLInputElement).value = 'sk-valid-key';
    // model left empty

    document.getElementById('saveSettingsBtn')!.click();
    await new Promise(r => setTimeout(r, 30));

    expect(alertMock).toHaveBeenCalled();
    expect(document.getElementById('settingsModal')!.classList.contains('visible')).toBe(true);
    window.alert = original;
  });
});
