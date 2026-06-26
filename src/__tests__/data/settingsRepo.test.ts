import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSettingMock, setSettingMock, deleteSettingMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn().mockResolvedValue(null),
  setSettingMock: vi.fn().mockResolvedValue(undefined),
  deleteSettingMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db.js', () => ({
  getSetting: getSettingMock,
  setSetting: setSettingMock,
  deleteSetting: deleteSettingMock,
}));

import { settingsRepo } from '../../data/settingsRepo';

beforeEach(() => {
  vi.clearAllMocks();
  getSettingMock.mockResolvedValue(null);
});

describe('settingsRepo', () => {
  it('getChatDays defaults to 3 when unset', async () => {
    getSettingMock.mockResolvedValue(null);
    expect(await settingsRepo.getChatDays()).toBe(3);
  });

  it('getChatDays parses a stored value', async () => {
    getSettingMock.mockResolvedValue('7');
    expect(await settingsRepo.getChatDays()).toBe(7);
  });

  it('setChatDays clamps to [1,14] and stores a string', async () => {
    await settingsRepo.setChatDays(99);
    expect(setSettingMock).toHaveBeenCalledWith('chat_days', '14');
    await settingsRepo.setChatDays(0);
    expect(setSettingMock).toHaveBeenCalledWith('chat_days', '3');
  });

  it('getLLMConfig reads all four keys', async () => {
    getSettingMock.mockImplementation(async (k: string) =>
      ({ llm_provider: 'anthropic', llm_api_key: 'sk', llm_model: 'm', llm_base_url: '' } as Record<string, string>)[k] ?? null
    );
    expect(await settingsRepo.getLLMConfig()).toEqual({
      provider: 'anthropic', apiKey: 'sk', model: 'm', baseUrl: '',
    });
  });

  it('saveLLMConfig blanks base url for non-openai providers', async () => {
    await settingsRepo.saveLLMConfig({ provider: 'anthropic', apiKey: 'sk', model: 'm', baseUrl: 'http://x' });
    expect(setSettingMock).toHaveBeenCalledWith('llm_base_url', '');
  });

  it('saveLLMConfig keeps base url for openai', async () => {
    await settingsRepo.saveLLMConfig({ provider: 'openai', apiKey: 'sk', model: 'm', baseUrl: 'http://x' });
    expect(setSettingMock).toHaveBeenCalledWith('llm_base_url', 'http://x');
  });

  it('clearLLMConfig deletes the four llm keys', async () => {
    await settingsRepo.clearLLMConfig();
    expect(deleteSettingMock).toHaveBeenCalledWith('llm_provider');
    expect(deleteSettingMock).toHaveBeenCalledWith('llm_api_key');
    expect(deleteSettingMock).toHaveBeenCalledWith('llm_model');
    expect(deleteSettingMock).toHaveBeenCalledWith('llm_base_url');
  });
});
