import { deleteSetting, getSetting, setSetting } from '../db.js';

export class SettingsModal {
  private overlay: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private baseUrlInput: HTMLInputElement;
  private baseUrlGroup: HTMLElement;
  private chatDaysInput: HTMLInputElement;
  private onSaveCallback: (() => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.providerSelect = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.modelInput = document.getElementById('llmModelInput') as HTMLInputElement;
    this.baseUrlInput = document.getElementById('llmBaseUrlInput') as HTMLInputElement;
    this.baseUrlGroup = document.getElementById('baseUrlGroup')!;
    this.chatDaysInput = document.getElementById('chatDaysInput') as HTMLInputElement;

    document.getElementById('settingsCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.getElementById('saveSettingsBtn')!.addEventListener('click', () => { void this.save(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.close(); });

    this.providerSelect.addEventListener('change', () => this.syncBaseUrlVisibility());
    this.syncBaseUrlVisibility();
  }

  private syncBaseUrlVisibility(): void {
    this.baseUrlGroup.style.display = this.providerSelect.value === 'openai' ? 'block' : 'none';
  }

  async open(): Promise<void> {
    const [provider, apiKey, model, baseUrl, chatDays] = await Promise.all([
      getSetting('llm_provider'),
      getSetting('llm_api_key'),
      getSetting('llm_model'),
      getSetting('llm_base_url'),
      getSetting('chat_days'),
    ]);

    this.providerSelect.value = provider ?? 'anthropic';
    this.apiKeyInput.value = apiKey ?? '';
    this.modelInput.value = model ?? '';
    this.baseUrlInput.value = baseUrl ?? '';
    this.chatDaysInput.value = chatDays ?? '3';
    this.syncBaseUrlVisibility();
    this.overlay.classList.add('visible');
  }

  setOnSave(fn: () => void): void {
    this.onSaveCallback = fn;
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  private async save(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();
    const chatDays = Math.max(1, Math.min(14, parseInt(this.chatDaysInput.value, 10) || 3)).toString();
    await setSetting('chat_days', chatDays);

    if (!apiKey) {
      await Promise.all([
        deleteSetting('llm_provider'),
        deleteSetting('llm_api_key'),
        deleteSetting('llm_model'),
        deleteSetting('llm_base_url'),
      ]);
      this.onSaveCallback?.();
      this.close();
      return;
    }

    const provider = this.providerSelect.value;
    const model = this.modelInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();

    if (!model) {
      alert('Please enter a model name.');
      return;
    }

    await setSetting('llm_provider', provider);
    await setSetting('llm_api_key', apiKey);
    await setSetting('llm_model', model);
    await setSetting('llm_base_url', provider === 'openai' ? baseUrl : '');

    this.onSaveCallback?.();
    this.close();
  }
}
