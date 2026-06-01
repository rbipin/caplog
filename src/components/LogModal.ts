export class LogModal {
  private overlay: HTMLElement;
  private subtitle: HTMLElement;
  private body: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('logModal')!;
    this.subtitle = document.getElementById('modalSubtitle')!;
    this.body = document.getElementById('modalBody')!;

    document.getElementById('modalCloseBtn')!.addEventListener('click', () => this.close());
    document.getElementById('modalFooterCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.close();
    });
  }

  open(entries: { date: string; items: { text: string; time: string }[] }[]): void {
    const now = new Date();
    this.subtitle.textContent = `Log entries — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
    this.body.innerHTML = entries.map((entry) => `
      <div class="log-view-entry">
        <div class="log-view-date">${entry.date}</div>
        ${entry.items.map((item) => `
          <div class="log-view-item">${item.text} <span class="log-view-time">${item.time}</span></div>
        `).join('')}
      </div>
    `).join('');
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }
}
