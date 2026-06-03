import { execute } from '../db.js';
import { formatLogEntry } from '../ai.js';
import { getAdapter } from '../llm/factory.js';
import { escapeHtml } from '../utils.js';
import type { Message } from '../types.js';

export class ChatArea {
  private el: HTMLElement;
  private currentSection: HTMLElement | null = null;
  private todaySection: HTMLElement | null = null;
  private onSidebarRefresh: (() => void) | null = null;

  constructor() {
    this.el = document.getElementById('chatArea')!;
  }

  setSidebarRefresh(fn: () => void): void {
    this.onSidebarRefresh = fn;
  }

  appendDaySection(label: string, dateSubLabel: string, isToday: boolean): void {
    const details = document.createElement('details');
    details.className = 'day-section';
    if (isToday) details.open = true;

    const summary = document.createElement('summary');
    const divider = document.createElement('div');
    divider.className = 'day-divider';
    divider.innerHTML = `
      <div class="day-divider-line"></div>
      <div class="day-divider-label">${label} — ${dateSubLabel}</div>
      <div class="day-divider-line"></div>
    `;
    summary.appendChild(divider);
    details.appendChild(summary);
    this.el.appendChild(details);
    this.currentSection = details;
    if (isToday) this.todaySection = details;
  }

  focusToday(): void {
    if (this.todaySection) this.currentSection = this.todaySection;
  }

  scrollToTop(): void {
    this.el.scrollTop = 0;
  }

  append(msg: Message, scroll = true): void {
    const rawHtml = msg.rawInput
      ? `<div class="msg-raw"><div class="msg-raw-label">Original input</div>${escapeHtml(msg.rawInput)}</div>`
      : '';

    const el = document.createElement('div');
    el.className = 'msg';
    el.innerHTML = `
      <div class="msg-time">${msg.time}</div>
      <div class="msg-body">
        <div class="msg-type ${msg.type}">${msg.typeLabel}</div>
        <div class="msg-content"${msg.entryId ? ' data-editable="true"' : ''}>${msg.content}</div>
        ${rawHtml}
      </div>
    `;

    if (msg.entryId) {
      const contentEl = el.querySelector('.msg-content') as HTMLElement;
      contentEl.addEventListener('click', () => {
        this.startEdit(el, contentEl, msg);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'msg-delete-btn';
      deleteBtn.title = 'Delete entry';
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await execute('DELETE FROM log_entries WHERE id = ?', [msg.entryId!]);
        el.remove();
        this.onSidebarRefresh?.();
      });
      el.appendChild(deleteBtn);
    }

    const container = this.currentSection ?? this.el;
    container.appendChild(el);
    if (scroll) this.el.scrollTop = this.el.scrollHeight;
  }

  private startEdit(msgEl: HTMLElement, contentEl: HTMLElement, msg: Message): void {
    if (msgEl.querySelector('.msg-edit-area')) return;

    const originalHtml = contentEl.innerHTML;
    const fallbackText = contentEl.textContent ?? '';
    contentEl.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'msg-edit-area';
    textarea.value = msg.rawInput ?? fallbackText;
    contentEl.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'msg-edit-actions';
    actions.innerHTML = `
      <button class="msg-edit-save">Save</button>
      <button class="msg-edit-cancel">Cancel</button>
    `;
    contentEl.appendChild(actions);

    textarea.focus();

    actions.querySelector('.msg-edit-cancel')!.addEventListener('click', (e) => {
      e.stopPropagation();
      contentEl.innerHTML = originalHtml;
    });

    actions.querySelector('.msg-edit-save')!.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newText = textarea.value.trim();
      if (!newText || !msg.entryId) return;

      const saveBtn = actions.querySelector('.msg-edit-save') as HTMLButtonElement;
      saveBtn.textContent = '...';
      saveBtn.disabled = true;

      const adapter = await getAdapter();
      let formatted = `<ul><li>${escapeHtml(newText)}</li></ul>`;

      if (adapter) {
        try {
          formatted = await formatLogEntry(newText, adapter);
        } catch {
          // fall through to raw text
        }
      }

      await execute(
        'UPDATE log_entries SET raw_text = ?, formatted_text = ? WHERE id = ?',
        [newText, formatted, msg.entryId]
      );

      msg.rawInput = newText;
      msg.content = formatted;
      contentEl.innerHTML = formatted;
    });
  }
}
