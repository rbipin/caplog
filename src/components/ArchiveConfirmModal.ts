export class ArchiveConfirmModal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private onConfirm: (() => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('archiveConfirmModal')!;
    this.titleEl = document.getElementById('archiveConfirmTitle')!;
    this.bodyEl = document.getElementById('archiveConfirmBody')!;

    document.getElementById('archiveConfirmCancelBtn')!.addEventListener('click', () => this.hide());
    document.getElementById('archiveConfirmDeleteBtn')!.addEventListener('click', () => {
      const cb = this.onConfirm;
      this.hide();
      cb?.();
    });
  }

  show(title: string, body: string, onConfirm: () => void): void {
    this.titleEl.textContent = title;
    this.bodyEl.textContent = body;
    this.onConfirm = onConfirm;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.onConfirm = null;
    this.overlay.classList.remove('visible');
  }
}
