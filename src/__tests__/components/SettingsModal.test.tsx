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

describe('SettingsModal', () => {
  it('loads existing settings into the form', async () => {
    getLLMConfigMock.mockResolvedValue({
      provider: 'anthropic',
      apiKey: 'secret',
      model: 'claude-x',
      baseUrl: '',
    });
    renderWithProviders(<SettingsModal onClose={() => {}} />);
    await waitFor(() =>
      expect((screen.getByPlaceholderText('claude-haiku-4-5-20251001') as HTMLInputElement).value).toBe(
        'claude-x'
      )
    );
  });

  it('clears the LLM config and closes when API key is blank', async () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsModal onClose={onClose} />);
    await waitFor(() => expect(getLLMConfigMock).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(clearLLMConfigMock).toHaveBeenCalled());
    expect(saveLLMConfigMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves the LLM config when a key and model are present', async () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsModal onClose={onClose} />);
    await waitFor(() => expect(getLLMConfigMock).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('sk-...'), 'my-key');
    await userEvent.type(screen.getByPlaceholderText('claude-haiku-4-5-20251001'), 'claude-x');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(saveLLMConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'my-key', model: 'claude-x', provider: 'anthropic' })
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('reveals the Base URL field only for the openai provider', async () => {
    renderWithProviders(<SettingsModal onClose={() => {}} />);
    await waitFor(() => expect(getLLMConfigMock).toHaveBeenCalled());
    expect(screen.queryByPlaceholderText('https://api.openai.com')).toBeNull();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'openai');
    expect(screen.getByPlaceholderText('https://api.openai.com')).toBeTruthy();
  });

  it('displays the app version from getVersion()', async () => {
    renderWithProviders(<SettingsModal onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('v1.4.0')).toBeTruthy());
  });
});
