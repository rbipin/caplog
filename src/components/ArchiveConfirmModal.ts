export class ArchiveConfirmModal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private deleteBtn: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('archiveConfirmModal')!;
    this.titleEl = document.getElementById('archiveConfirmTitle')!;
    this.bodyEl = document.getElementById('archiveConfirmBody')!;
    this.deleteBtn = document.getElementById('archiveConfirmDeleteBtn')!;

    document.getElementById('archiveConfirmCancelBtn')!.addEventListener('click', () => this.hide());
  }

  show(title: string, body: string, onConfirm: () => void): void {
    this.titleEl.textContent = title;
    this.bodyEl.textContent = body;
    this.overlay.classList.add('visible');

    const fresh = this.deleteBtn.cloneNode(true) as HTMLElement;
    this.deleteBtn.replaceWith(fresh);
    this.deleteBtn = fresh;
    this.deleteBtn.addEventListener('click', () => {
      this.hide();
      onConfirm();
    });
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }
}
