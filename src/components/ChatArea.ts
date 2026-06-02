import { execute } from '../db.js';
import { formatLogEntry } from '../ai.js';
import { getAdapter } from '../llm/factory.js';
import { escapeHtml } from '../utils.js';
import type { Message, LogEntry } from '../types.js';

export class ChatArea {
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById('chatArea')!;
    this.appendDivider('Today');
  }

  loadEntries(entries: LogEntry[]): void {
    for (const entry of entries) {
      const time = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      this.append({
        time,
        type: 'log',
        typeLabel: 'Log entry',
        content: entry.formatted_text,
        rawInput: entry.raw_text !== entry.formatted_text ? entry.raw_text : undefined,
        entryId: entry.id,
      });
    }
  }

  appendDivider(label: string): void {
    const now = new Date();
    const shortDate = now.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    const el = document.createElement('div');
    el.className = 'day-divider';
    el.innerHTML = `
      <div class="day-divider-line"></div>
      <div class="day-divider-label">${label} — ${shortDate}</div>
      <div class="day-divider-line"></div>
    `;
    this.el.appendChild(el);
  }

  append(msg: Message): void {
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
    }

    this.el.appendChild(el);
    this.el.scrollTop = this.el.scrollHeight;
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
