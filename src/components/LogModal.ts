import { escapeHtml } from '../utils.js';
import { exportMarkdown } from '../export.js';
import type { TodoItem } from '../types.js';

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
    document.getElementById('modalExportBtn')!.addEventListener('click', () => { void exportMarkdown(); });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) {
        e.stopImmediatePropagation();
        this.close();
      }
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

  openDay(dateLabel: string, entries: { text: string; time: string }[], todos: TodoItem[]): void {
    this.subtitle.textContent = dateLabel;

    const entriesHtml = entries.length > 0 ? `
      <div class="log-view-entry">
        <div class="log-view-date">Log Entries</div>
        ${entries.map((item) => `
          <div class="log-view-item">${item.text} <span class="log-view-time">${item.time}</span></div>
        `).join('')}
      </div>
    ` : '';

    const todosHtml = todos.length > 0 ? `
      <div class="log-view-entry">
        <div class="log-view-date">Completed Todos</div>
        ${todos.map((t) => `
          <div class="log-view-item">✓ ${escapeHtml(t.text)}</div>
        `).join('')}
      </div>
    ` : '';

    this.body.innerHTML = entriesHtml + todosHtml;
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }
}
