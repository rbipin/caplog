export const COMMANDS = ['/todo', '/done', '/important', '/by'] as const;

export class InputHandler {
  private input: HTMLTextAreaElement;
  private onSubmit: (value: string) => Promise<void> | void;

  constructor(onSubmit: (value: string) => Promise<void> | void) {
    this.input = document.getElementById('chatInput') as HTMLTextAreaElement;
    this.onSubmit = onSubmit;

    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.getElementById('sendBtn')!.addEventListener('click', () => { void this.submit(); });
  }

  private handleInput(): void {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
    const isCmd = COMMANDS.some((cmd) => this.input.value.trimStart().startsWith(cmd));
    this.input.classList.toggle('is-command', isCmd);
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void this.submit();
    }
  }

  setLoading(loading: boolean): void {
    this.input.disabled = loading;
    const btn = document.getElementById('sendBtn') as HTMLButtonElement;
    btn.textContent = loading ? '...' : '↑';
    btn.disabled = loading;
  }

  private async submit(): Promise<void> {
    const value = this.input.value.trim();
    if (!value) return;
    this.input.value = '';
    this.input.style.height = 'auto';
    this.input.classList.remove('is-command');
    try {
      await this.onSubmit(value);
    } catch (err) {
      console.error('handleInput error:', err);
    }
  }
}
