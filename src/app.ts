import { initDB, query, execute } from './db.js';
import { formatLogEntry } from './ai.js';
import { exportMarkdown } from './export.js';
import { getAdapter } from './llm/factory.js';
import { escapeHtml, stripHtml } from './utils.js';
import type { LogEntry } from './types.js';
import { parseCommand } from './commands.js';
import { LogModal } from './components/LogModal.js';
import { InputHandler } from './components/InputHandler.js';
import { ChatArea } from './components/ChatArea.js';
import { TodoPanel } from './components/TodoPanel.js';
import { Sidebar } from './components/Sidebar.js';
import { SettingsModal } from './components/SettingsModal.js';

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
      await Promise.all([this.todoPanel.load(), this.loadRecentEntries()]);
      await getAdapter();
    } catch (err) {
      console.error('Startup load failed:', err);
      this.chatArea.append({
        time: '--:--', type: 'system', typeLabel: 'System',
        content: 'Failed to load data. Please restart the app.',
      });
    }
  }

  private async loadRecentEntries(): Promise<void> {
    const chatDaysInput = document.getElementById('chatDaysInput') as HTMLInputElement | null;
    const days = chatDaysInput ? (parseInt(chatDaysInput.value, 10) || 7) : 7;

    const dates = await query<{ date: string }>(
      `SELECT DISTINCT date FROM log_entries ORDER BY date DESC LIMIT ?`,
      [days]
    );

    // Reverse so oldest is first (chronological order)
    const orderedDates = [...dates].reverse();

    const today = new Date().toISOString().split('T')[0];

    for (const { date } of orderedDates) {
      const d = new Date(date + 'T00:00:00');
      const isToday = date === today;
      const label = isToday
        ? 'Today'
        : d.toLocaleString('en-US', { weekday: 'long' });
      const dateSubLabel = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

      this.chatArea.appendDaySection(label, dateSubLabel, isToday);

      const entries = await query<LogEntry>(
        'SELECT * FROM log_entries WHERE date = ? ORDER BY created_at ASC',
        [date]
      );

      for (const entry of entries) {
        const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
        this.chatArea.append({
          time,
          type: 'log',
          typeLabel: 'Log entry',
          content: entry.formatted_text,
          rawInput: entry.raw_text !== entry.formatted_text ? entry.raw_text : undefined,
          entryId: entry.id,
        }, false);
      }
    }

    this.chatArea.scrollToTop();
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

    const cmd = parseCommand(value);

    if (cmd.type === 'todo') {
      await this.todoPanel.add(cmd.text, false, cmd.deadline);
      void this.sidebar.refresh();
      const label = cmd.deadline ? `Todo created — due ${cmd.deadline}` : 'Todo created';
      this.chatArea.append({ time, type: 'todo-created', typeLabel: label, content: escapeHtml(cmd.text) });

    } else if (cmd.type === 'done') {
      const found = await this.todoPanel.completeByText(cmd.task);
      void this.sidebar.refresh();
      this.chatArea.append({
        time, type: 'system', typeLabel: 'System',
        content: found
          ? `Marked <span style="color:var(--text)">"${escapeHtml(cmd.task)}"</span> as complete.`
          : `No active todo matching "${escapeHtml(cmd.task)}" found.`,
      });

    } else if (cmd.type === 'important') {
      await this.todoPanel.add(cmd.text, true, null);
      void this.sidebar.refresh();
      this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: escapeHtml(cmd.text) });

    } else if (cmd.type === 'log') {
      const today = new Date().toISOString().split('T')[0];
      const adapter = await getAdapter();

      let formatted = `<ul><li>${escapeHtml(cmd.text)}</li></ul>`;

      if (adapter) {
        this.inputHandler.setLoading(true);
        try {
          formatted = await formatLogEntry(cmd.text, adapter);
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
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  new App();
});
