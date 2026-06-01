import { initDB, query, execute, getSetting, setSetting } from './db.js';
import { formatLogEntry } from './ai.js';
import { exportMarkdown } from './export.js';
import { getAdapter } from './llm/factory.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodoItem {
  id: number;
  text: string;
  is_important: number;
  is_completed: number;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
}

type MessageType = 'log' | 'todo-created' | 'system';

interface Message {
  time: string;
  type: MessageType;
  typeLabel: string;
  content: string;
  rawInput?: string;
  entryId?: number;   // only set for 'log' type messages loaded from DB
}

interface LogEntry {
  id: number;
  date: string;
  raw_text: string;
  formatted_text: string;
  created_at: string;
}

interface DayStats {
  date: string;
  log_count: number;
  todo_done_count: number;
  preview: string;
}

// ─── LogModal ─────────────────────────────────────────────────────────────────

class LogModal {
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

// ─── TodoPanel ────────────────────────────────────────────────────────────────

class TodoPanel {
  private listEl: HTMLElement;
  private countEl: HTMLElement;

  constructor() {
    this.listEl = document.getElementById('todoList')!;
    this.countEl = document.getElementById('todoCount')!;
  }

  async load(): Promise<void> {
    const todos = await query<TodoItem>(
      'SELECT * FROM todos ORDER BY is_important DESC, CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at ASC'
    );
    this.render(todos);
  }

  async add(text: string, isImportant = false, deadline: string | null = null): Promise<void> {
    await execute(
      'INSERT INTO todos (text, is_important, deadline, created_at) VALUES (?, ?, ?, ?)',
      [text, isImportant ? 1 : 0, deadline, new Date().toISOString()]
    );
    await this.load();
  }

  async complete(id: number): Promise<void> {
    await execute(
      'UPDATE todos SET is_completed = 1, completed_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    await this.load();
  }

  async completeByText(text: string): Promise<boolean> {
    const escaped = text.replace(/[%_\\]/g, '\\$&');
    const rows = await query<TodoItem>(
      "SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?) ESCAPE '\\'",
      [`%${escaped}%`]
    );
    if (rows.length === 0) return false;
    await this.complete(rows[0].id);
    return true;
  }

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM todos WHERE id = ?', [id]);
    await this.load();
  }

  private todoStatus(todo: TodoItem): string {
    if (todo.is_completed) return 'completed';
    if (todo.is_important) return 'important';
    if (todo.deadline) {
      const today = new Date().toISOString().split('T')[0];
      if (todo.deadline <= today) return 'overdue';
    }
    return 'open';
  }

  private renderItem(todo: TodoItem): HTMLElement {
    const status = this.todoStatus(todo);
    const el = document.createElement('div');
    el.className = `todo-item${status !== 'open' ? ` ${status}` : ''}`;
    el.dataset.id = String(todo.id);

    const checkInner = status === 'completed' ? '<span class="completed-check">✓</span>' : '';

    const metaHtml = (() => {
      const parts: string[] = [];
      if (todo.deadline) {
        parts.push(`<span class="todo-deadline${status === 'overdue' ? ' overdue' : ''}">${escapeHtml(todo.deadline)}</span>`);
      }
      if (status === 'important') {
        parts.push('<span class="todo-badge important">important</span>');
      } else if (status === 'overdue') {
        parts.push('<span class="todo-badge overdue">due soon</span>');
      }
      return parts.length ? `<div class="todo-meta">${parts.join('')}</div>` : '';
    })();

    el.innerHTML = `
      <div class="todo-check">${checkInner}</div>
      <div style="flex:1">
        <div class="todo-text">${escapeHtml(todo.text)}</div>
        ${metaHtml}
      </div>
      <button class="todo-delete-btn" title="Delete">✕</button>
    `;

    if (status !== 'completed') {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.todo-delete-btn')) return;
        this.complete(todo.id);
      });
    }

    el.querySelector('.todo-delete-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.delete(todo.id);
    });

    return el;
  }

  private render(todos: TodoItem[]): void {
    this.listEl.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    const sections: { label: string; filter: (t: TodoItem) => boolean }[] = [
      { label: 'Important', filter: (t) => !t.is_completed && !!t.is_important },
      { label: 'Due / Overdue', filter: (t) => !t.is_completed && !t.is_important && !!t.deadline && t.deadline <= today },
      { label: 'Open', filter: (t) => !t.is_completed && !t.is_important && (!t.deadline || t.deadline > today) },
      { label: 'Completed today', filter: (t) => !!t.is_completed },
    ];

    for (const section of sections) {
      const items = todos.filter(section.filter);
      if (items.length === 0) continue;

      const label = document.createElement('div');
      label.className = 'todo-section-label';
      label.textContent = section.label;
      this.listEl.appendChild(label);

      for (const item of items) {
        this.listEl.appendChild(this.renderItem(item));
      }
    }

    const open = todos.filter((t) => !t.is_completed).length;
    const done = todos.filter((t) => t.is_completed).length;
    this.countEl.textContent = `${open} open · ${done} done`;
  }
}

// ─── ChatArea ─────────────────────────────────────────────────────────────────

class ChatArea {
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
    if (msgEl.querySelector('.msg-edit-area')) return; // already editing

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

    actions.querySelector('.msg-edit-cancel')!.addEventListener('click', () => {
      contentEl.innerHTML = originalHtml;
    });

    actions.querySelector('.msg-edit-save')!.addEventListener('click', async () => {
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

class Sidebar {
  private monthLabel: HTMLElement;
  private dayList: HTMLElement;

  constructor() {
    this.monthLabel = document.getElementById('sidebarMonthLabel')!;
    this.dayList = document.getElementById('dayList')!;
    const now = new Date();
    this.monthLabel.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this.load();
  }

  refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const stats = await query<DayStats>(`
      SELECT
        l.date,
        COUNT(l.id) AS log_count,
        (SELECT COUNT(*) FROM todos t WHERE t.completed_at LIKE l.date || '%') AS todo_done_count,
        (SELECT raw_text FROM log_entries WHERE date = l.date ORDER BY created_at ASC LIMIT 1) AS preview
      FROM log_entries l
      GROUP BY l.date
      ORDER BY l.date DESC
      LIMIT 30
    `);

    this.dayList.innerHTML = '';
    stats.forEach((s, i) => this.dayList.appendChild(this.renderEntry(s, i === 0)));
  }

  private renderEntry(s: DayStats, active: boolean): HTMLElement {
    const d = new Date(s.date + 'T00:00:00');
    const dowNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dow = dowNames[d.getDay()];
    const day = d.getDate();

    const metaTags: string[] = [];
    if (s.log_count > 0) metaTags.push(`<span class="tag tag-log">${s.log_count} entries</span>`);
    if (s.todo_done_count > 0) metaTags.push(`<span class="tag tag-todo">${s.todo_done_count} done</span>`);

    const el = document.createElement('div');
    el.className = `day-entry${active ? ' active' : ''}`;
    el.innerHTML = `
      <div class="day-entry-date">
        <div class="day-entry-dow">${dow}</div>
        <div class="day-entry-num">${day}</div>
      </div>
      <div>
        <div class="day-entry-preview">${escapeHtml(s.preview ?? '')}</div>
        <div class="day-entry-meta">${metaTags.join('')}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      document.querySelectorAll('.day-entry').forEach((e) => e.classList.remove('active'));
      el.classList.add('active');
    });
    return el;
  }
}

// ─── InputHandler ─────────────────────────────────────────────────────────────

const COMMANDS = ['/todo', '/done', '/important', '/by'] as const;

class InputHandler {
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
    btn.textContent = loading ? '...' : 'Send';
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

// ─── SettingsModal ────────────────────────────────────────────────────────────

class SettingsModal {
  private overlay: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private baseUrlInput: HTMLInputElement;
  private baseUrlGroup: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.providerSelect = document.getElementById('llmProviderSelect') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.modelInput = document.getElementById('llmModelInput') as HTMLInputElement;
    this.baseUrlInput = document.getElementById('llmBaseUrlInput') as HTMLInputElement;
    this.baseUrlGroup = document.getElementById('baseUrlGroup')!;

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
    const [provider, apiKey, model, baseUrl] = await Promise.all([
      getSetting('llm_provider'),
      getSetting('llm_api_key'),
      getSetting('llm_model'),
      getSetting('llm_base_url'),
    ]);

    this.providerSelect.value = provider ?? 'anthropic';
    this.apiKeyInput.value = apiKey ?? '';
    this.modelInput.value = model ?? '';
    this.baseUrlInput.value = baseUrl ?? '';
    this.syncBaseUrlVisibility();
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  private async save(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      await Promise.all([
        execute('DELETE FROM settings WHERE key = ?', ['llm_provider']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_api_key']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_model']),
        execute('DELETE FROM settings WHERE key = ?', ['llm_base_url']),
      ]);
      this.close();
      return;
    }

    const provider = this.providerSelect.value;
    const model = this.modelInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();

    await setSetting('llm_provider', provider);
    await setSetting('llm_api_key', apiKey);
    await setSetting('llm_model', model);
    await setSetting('llm_base_url', provider === 'openai' ? baseUrl : '');

    this.close();
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;
  private settings: SettingsModal;
  private sidebar: Sidebar;
  private inputHandler!: InputHandler;

  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    this.settings = new SettingsModal();
    this.sidebar = new Sidebar();
    this.initHeader();
    this.inputHandler = new InputHandler((value) => this.handleInput(value));
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await Promise.all([this.todoPanel.load(), this.loadTodayEntries()]);
    } catch (err) {
      console.error('Startup load failed:', err);
      this.chatArea.append({
        time: '--:--', type: 'system', typeLabel: 'System',
        content: 'Failed to load data. Please restart the app.',
      });
    }
  }

  private async loadTodayEntries(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const entries = await query<LogEntry>(
      'SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC',
      [today]
    );
    this.chatArea.loadEntries(entries);
  }

  private initHeader(): void {
    const dateEl = document.getElementById('headerDate')!;
    dateEl.textContent = new Date().toLocaleString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    document.getElementById('sidebarToggleBtn')!.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('viewLogBtn')!.addEventListener('click', () => this.openLogModal());
    document.getElementById('settingsBtn')!.addEventListener('click', () => { void this.settings.open(); });
    document.getElementById('exportBtn')!.addEventListener('click', () => { void exportMarkdown(); });
  }

  private toggleSidebar(): void {
    const app = document.getElementById('app')!;
    const btn = document.getElementById('sidebarToggleBtn')!;
    app.classList.toggle('sidebar-collapsed');
    btn.classList.toggle('active');
  }

  private async openLogModal(): Promise<void> {
    const entries = await query<LogEntry>(
      'SELECT * FROM log_entries ORDER BY date DESC, created_at ASC'
    );

    const grouped = new Map<string, { text: string; time: string }[]>();
    for (const e of entries) {
      const time = new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (!grouped.has(e.date)) grouped.set(e.date, []);
      grouped.get(e.date)!.push({ text: stripHtml(e.formatted_text), time });
    }

    const modalData = Array.from(grouped.entries()).map(([date, items]) => {
      const d = new Date(date + 'T00:00:00');
      const label = d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      return { date: label, items };
    });

    this.modal.open(modalData);
  }

  private async handleInput(value: string): Promise<void> {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    if (value.startsWith('/todo')) {
      const rest = value.replace('/todo', '').trim();
      const byIdx = rest.indexOf(' /by ');
      let text = rest;
      let deadline: string | null = null;
      if (byIdx !== -1) {
        text = rest.slice(0, byIdx).trim();
        deadline = rest.slice(byIdx + 5).trim();
      }
      if (!text) return;
      await this.todoPanel.add(text, false, deadline);
      void this.sidebar.refresh();
      const label = deadline ? `Todo created — due ${deadline}` : 'Todo created';
      this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: escapeHtml(text) });

    } else if (value.startsWith('/done')) {
      const task = value.replace('/done', '').trim();
      const found = await this.todoPanel.completeByText(task);
      void this.sidebar.refresh();
      this.chatArea.append({
        time, type: 'system', typeLabel: 'System',
        content: found
          ? `Marked <span style="color:var(--text)">"${escapeHtml(task)}"</span> as complete.`
          : `No active todo matching "${escapeHtml(task)}" found.`,
      });

    } else if (value.startsWith('/important')) {
      const text = value.replace('/important', '').trim();
      await this.todoPanel.add(text, true, null);
      void this.sidebar.refresh();
      this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: escapeHtml(text) });

    } else {
      const today = new Date().toISOString().split('T')[0];
      const adapter = await getAdapter();

      let formatted = `<ul><li>${escapeHtml(value)}</li></ul>`;

      if (adapter) {
        this.inputHandler.setLoading(true);
        try {
          formatted = await formatLogEntry(value, adapter);
        } catch (err) {
          console.error('AI format failed:', err);
          this.chatArea.append({
            time, type: 'system', typeLabel: 'System',
            content: 'AI formatting failed — saved raw text.',
          });
        } finally {
          this.inputHandler.setLoading(false);
        }
      }

      await execute(
        'INSERT INTO log_entries (date, raw_text, formatted_text, created_at) VALUES (?, ?, ?, ?)',
        [today, value, formatted, new Date().toISOString()]
      );

      const rows = await query<{ id: number }>(
        'SELECT id FROM log_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1',
        [today]
      );

      this.chatArea.append({
        time, type: 'log', typeLabel: 'Log entry',
        content: formatted,
        rawInput: value,
        entryId: rows[0]?.id,
      });

      void this.sidebar.refresh();
    }
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  new App();
});
