import { initDB, query, execute, getSetting, setSetting } from './db.js';
import { formatLogEntry } from './ai.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
      if (e.key === 'Escape') this.close();
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
    const rows = await query<TodoItem>(
      'SELECT * FROM todos WHERE is_completed = 0 AND lower(text) LIKE lower(?)',
      [`%${text}%`]
    );
    if (rows.length === 0) return false;
    await this.complete(rows[0].id);
    return true;
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
      <div>
        <div class="todo-text">${escapeHtml(todo.text)}</div>
        ${metaHtml}
      </div>
    `;

    if (status !== 'completed') {
      el.addEventListener('click', () => this.complete(todo.id));
    }
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
      ? `<div class="msg-raw"><div class="msg-raw-label">Original input</div>${msg.rawInput}</div>`
      : '';

    const el = document.createElement('div');
    el.className = 'msg';
    el.innerHTML = `
      <div class="msg-time">${msg.time}</div>
      <div class="msg-body">
        <div class="msg-type ${msg.type}">${msg.typeLabel}</div>
        <div class="msg-content">${msg.content}</div>
        ${rawHtml}
      </div>
    `;
    this.el.appendChild(el);
    this.el.scrollTop = this.el.scrollHeight;
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
  private apiKeyInput: HTMLInputElement;

  constructor() {
    this.overlay = document.getElementById('settingsModal')!;
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;

    document.getElementById('settingsCloseBtn')!.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.getElementById('saveSettingsBtn')!.addEventListener('click', () => { void this.save(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }

  async open(): Promise<void> {
    const key = await getSetting('anthropic_api_key');
    this.apiKeyInput.value = key ?? '';
    this.overlay.classList.add('visible');
  }

  close(): void {
    this.overlay.classList.remove('visible');
  }

  private async save(): Promise<void> {
    const key = this.apiKeyInput.value.trim();
    if (key) await setSetting('anthropic_api_key', key);
    this.close();
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;
  private settings: SettingsModal;
  private inputHandler!: InputHandler;

  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    this.settings = new SettingsModal();
    new Sidebar();
    this.initHeader();
    this.inputHandler = new InputHandler((value) => this.handleInput(value));
    this.todoPanel.load();
    this.loadTodayEntries();
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
    document.getElementById('settingsBtn')?.addEventListener('click', () => { void this.settings.open(); });
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
      grouped.get(e.date)!.push({ text: e.formatted_text.replace(/<[^>]+>/g, '').trim(), time });
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
      const label = deadline ? `Todo created — due ${deadline}` : 'Todo created';
      this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: text });

    } else if (value.startsWith('/done')) {
      const task = value.replace('/done', '').trim();
      const found = await this.todoPanel.completeByText(task);
      this.chatArea.append({
        time, type: 'system', typeLabel: 'System',
        content: found
          ? `Marked <span style="color:var(--text)">"${task}"</span> as complete.`
          : `No active todo matching "${task}" found.`,
      });

    } else if (value.startsWith('/important')) {
      const text = value.replace('/important', '').trim();
      await this.todoPanel.add(text, true, null);
      this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: text });

    } else {
      const today = new Date().toISOString().split('T')[0];
      const apiKey = await getSetting('anthropic_api_key');

      let formatted = `<ul><li>${escapeHtml(value)}</li></ul>`;

      if (apiKey) {
        this.inputHandler.setLoading(true);
        try {
          formatted = await formatLogEntry(value, apiKey);
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
      this.chatArea.append({
        time, type: 'log', typeLabel: 'Log entry',
        content: formatted,
        rawInput: value,
      });
    }
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  new App();
});
