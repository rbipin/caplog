import { initDB, query, execute, getSetting } from './db.js';
import { formatLogEntry } from './ai.js';
import { exportMarkdown } from './export.js';
import { getAdapter, runLLMMigration } from './llm/factory.js';
import { escapeHtml, stripHtml, parseLocalDate, getToday, formatTime } from './utils.js';
import type { LLMAdapter } from './llm/adapter.js';
import type { LogEntry, TodoItem, FeedItem } from './types.js';
import { parseCommand } from './commands.js';
import type { ParsedCommand } from './commands.js';
import { LogModal } from './components/LogModal.js';
import { InputHandler } from './components/InputHandler.js';
import { ChatArea } from './components/ChatArea.js';
import { TodoPanel } from './components/TodoPanel.js';
import { Sidebar } from './components/Sidebar.js';
import { SettingsModal } from './components/SettingsModal.js';
import { ArchiveModal } from './components/ArchiveModal.js';
import { ArchiveConfirmModal } from './components/ArchiveConfirmModal.js';
import { getCurrentWindow } from '@tauri-apps/api/window';

type LogCommand = Extract<ParsedCommand, { type: 'log' }>;
type TodoCommand = Extract<ParsedCommand, { type: 'todo' }>;
type DoneCommand = Extract<ParsedCommand, { type: 'done' }>;
type ImportantCommand = Extract<ParsedCommand, { type: 'important' }>;

class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;
  private settings: SettingsModal;
  private sidebar: Sidebar;
  private inputHandler!: InputHandler;
  private archive: ArchiveModal;
  private archiveConfirm: ArchiveConfirmModal;
  private adapter: LLMAdapter | null = null;
  private chatDays: number = 3;
  readonly ready: Promise<void>;

  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    this.settings = new SettingsModal();
    this.archiveConfirm = new ArchiveConfirmModal();
    this.archive = new ArchiveModal((date) => { void this.openDayModal(date); }, this.archiveConfirm);
    this.sidebar = new Sidebar((date) => { void this.openDayModal(date); });
    this.chatArea.setSidebarRefresh(() => this.sidebar.refresh());
    this.chatArea.setAdapterGetter(() => this.adapter);
    this.todoPanel.setOnComplete(() => this.sidebar.refresh());
    this.settings.setOnSave(() => { void this.applyChatDays(); void this.refreshAdapter(); });
    this.initHeader();
    this.inputHandler = new InputHandler((value) => this.handleInput(value));
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    try {
      await runLLMMigration();
      await this.applyChatDays();
      await this.loadRecentEntries(this.chatDays);
      this.adapter = await getAdapter();
    } catch (err) {
      console.error('Startup load failed:', err);
      this.chatArea.append({
        time: '--:--', type: 'system', typeLabel: 'System',
        content: 'Failed to load data. Please restart the app.',
      });
    }
  }

  private async applyChatDays(): Promise<void> {
    this.chatDays = parseInt((await getSetting('chat_days')) ?? '3') || 3;
    await this.sidebar.refresh(this.chatDays);
    await this.todoPanel.load(this.chatDays);
  }

  private async refreshAdapter(): Promise<void> {
    this.adapter = await getAdapter();
  }

  private async loadRecentEntries(days: number): Promise<void> {
    const today = getToday();

    const dateRows = await query<{ date: string }>(
      'SELECT DISTINCT date FROM log_entries ORDER BY date DESC LIMIT ?',
      [days]
    );

    const dates = dateRows.map((r) => r.date);
    if (!dates.includes(today)) dates.push(today);
    dates.sort((a, b) => b.localeCompare(a));

    for (const date of dates) {
      const isToday = date === today;
      const d = parseLocalDate(date);
      const diffMs = parseLocalDate(today).getTime() - d.getTime();
      const diffDays = Math.round(diffMs / 86400000);
      const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : d.toLocaleString('en-US', { weekday: 'long' });
      const dateSubLabel = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

      this.chatArea.appendDaySection(label, dateSubLabel, isToday);

      const [entries, todos] = await Promise.all([
        query<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC', [date]),
        query<TodoItem>('SELECT * FROM todos WHERE created_at LIKE ? ORDER BY created_at ASC', [date + '%']),
      ]);

      const items: FeedItem[] = [
        ...entries.map((e) => ({ created_at: e.created_at, kind: 'log' as const, entry: e })),
        ...todos.map((t) => ({ created_at: t.created_at, kind: 'todo' as const, todo: t })),
      ].sort((a, b) => a.created_at.localeCompare(b.created_at));

      for (const item of items) {
        if (item.kind === 'log') {
          const e = item.entry;
          const time = formatTime(e.created_at);
          this.chatArea.append({
            time, type: 'log', typeLabel: 'Log entry',
            content: e.formatted_text,
            rawInput: e.raw_text !== e.formatted_text ? e.raw_text : undefined,
            entryId: e.id,
          }, false);
        } else {
          const t = item.todo;
          const time = formatTime(t.created_at);
          const typeLabel = t.deadline ? `Todo created — due ${t.deadline}` : 'Todo created';
          this.chatArea.append({ time, type: 'todo-created', typeLabel, content: escapeHtml(t.text) }, false);
        }
      }
    }

    this.chatArea.focusToday();
    this.chatArea.scrollToTop();
  }

  private async openDayModal(date: string): Promise<void> {
    const d = parseLocalDate(date);
    const dateLabel = d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const [entries, todos] = await Promise.all([
      query<LogEntry>('SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC', [date]),
      query<TodoItem>('SELECT * FROM todos WHERE completed_at LIKE ? ORDER BY completed_at ASC', [date + '%']),
    ]);

    const items = entries.map((e) => ({
      text: stripHtml(e.formatted_text),
      time: formatTime(e.created_at),
    }));

    this.modal.openDay(dateLabel, items, todos);
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
    document.getElementById('archiveBtn')!.addEventListener('click', () => this.archive.show());
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
      const time = formatTime(e.created_at);
      if (!grouped.has(e.date)) grouped.set(e.date, []);
      grouped.get(e.date)!.push({ text: stripHtml(e.formatted_text), time });
    }

    const modalData = Array.from(grouped.entries()).map(([date, items]) => {
      const d = parseLocalDate(date);
      const label = d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      return { date: label, items };
    });

    this.modal.open(modalData);
  }

  private async handleInput(value: string): Promise<void> {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const cmd = parseCommand(value);

    if (cmd.type === 'log') await this.handleLog(cmd, time);
    else if (cmd.type === 'todo') await this.handleTodo(cmd, time);
    else if (cmd.type === 'done') await this.handleDone(cmd, time);
    else if (cmd.type === 'important') await this.handleImportant(cmd, time);
  }

  private async handleLog(cmd: LogCommand, time: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    let formatted = `<ul><li>${escapeHtml(cmd.text)}</li></ul>`;

    if (this.adapter) {
      this.inputHandler.setLoading(true);
      try {
        formatted = await formatLogEntry(cmd.text, this.adapter);
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
      [today, cmd.text, formatted, new Date().toISOString()]
    );

    const rows = await query<{ id: number }>(
      'SELECT id FROM log_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1',
      [today]
    );

    this.chatArea.append({
      time, type: 'log', typeLabel: 'Log entry',
      content: formatted,
      rawInput: cmd.text,
      entryId: rows[0]?.id,
    });

    void this.sidebar.refresh();
  }

  private async handleTodo(cmd: TodoCommand, time: string): Promise<void> {
    await this.todoPanel.add(cmd.text, false, cmd.deadline);
    void this.sidebar.refresh();
    const label = cmd.deadline ? `Todo created — due ${cmd.deadline}` : 'Todo created';
    this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: escapeHtml(cmd.text) });
  }

  private async handleDone(cmd: DoneCommand, time: string): Promise<void> {
    const found = await this.todoPanel.completeByText(cmd.task);
    void this.sidebar.refresh();
    this.chatArea.append({
      time, type: 'system', typeLabel: 'System',
      content: found
        ? `Marked <span style="color:var(--text)">"${escapeHtml(cmd.task)}"</span> as complete.`
        : `No active todo matching "${escapeHtml(cmd.task)}" found.`,
    });
  }

  private async handleImportant(cmd: ImportantCommand, time: string): Promise<void> {
    await this.todoPanel.add(cmd.text, true, null);
    void this.sidebar.refresh();
    this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: escapeHtml(cmd.text) });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  const app = new App();
  await app.ready;
  await getCurrentWindow().show();
});
