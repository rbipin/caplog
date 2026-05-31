import { initDB } from './db.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type TodoStatus = 'open' | 'important' | 'overdue' | 'completed';

interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  deadline?: string;
}

type MessageType = 'log' | 'todo-created' | 'system';

interface Message {
  time: string;
  type: MessageType;
  typeLabel: string;
  content: string;
  rawInput?: string;
}

interface DayEntry {
  date: Date;
  preview: string;
  logCount: number;
  todoDoneCount: number;
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
  private todos: TodoItem[] = [];

  constructor() {
    this.listEl = document.getElementById('todoList')!;
    this.countEl = document.getElementById('todoCount')!;
    this.loadSeedData();
    this.render();
  }

  private loadSeedData(): void {
    this.todos = [
      { id: '1', text: 'Write unit tests for payment webhook handler', status: 'important' },
      { id: '2', text: 'Send API docs to mobile team', status: 'overdue', deadline: 'Due Feb 24' },
      { id: '3', text: 'Set up monitoring alerts for prod database', status: 'open', deadline: 'Due Feb 28' },
      { id: '4', text: 'Research new logging library options', status: 'open' },
      { id: '5', text: 'Update staging environment config', status: 'completed' },
    ];
  }

  add(text: string, status: TodoStatus = 'open', deadline?: string): void {
    const id = Date.now().toString();
    this.todos.push({ id, text, status, deadline });
    this.render();
  }

  complete(id: string): void {
    const todo = this.todos.find((t) => t.id === id);
    if (todo && todo.status !== 'completed') {
      todo.status = 'completed';
      this.render();
    }
  }

  private updateCount(): void {
    const open = this.todos.filter((t) => t.status !== 'completed').length;
    const done = this.todos.filter((t) => t.status === 'completed').length;
    this.countEl.textContent = `${open} open · ${done} done`;
  }

  private renderItem(todo: TodoItem): HTMLElement {
    const el = document.createElement('div');
    el.className = `todo-item${todo.status !== 'open' ? ` ${todo.status}` : ''}`;
    el.dataset.id = todo.id;

    const checkInner = todo.status === 'completed'
      ? '<span class="completed-check">✓</span>'
      : '';

    const metaHtml = (() => {
      const parts: string[] = [];
      if (todo.deadline) {
        const isOverdue = todo.status === 'overdue';
        parts.push(`<span class="todo-deadline${isOverdue ? ' overdue' : ''}">${todo.deadline}</span>`);
      }
      if (todo.status === 'important') {
        parts.push('<span class="todo-badge important">important</span>');
      } else if (todo.status === 'overdue') {
        parts.push('<span class="todo-badge overdue">due soon</span>');
      }
      return parts.length ? `<div class="todo-meta">${parts.join('')}</div>` : '';
    })();

    el.innerHTML = `
      <div class="todo-check">${checkInner}</div>
      <div>
        <div class="todo-text">${todo.text}</div>
        ${metaHtml}
      </div>
    `;

    if (todo.status !== 'completed') {
      el.addEventListener('click', () => this.complete(todo.id));
    }

    return el;
  }

  render(): void {
    this.listEl.innerHTML = '';

    const sections: { label: string; filter: (t: TodoItem) => boolean }[] = [
      { label: 'Important', filter: (t) => t.status === 'important' },
      { label: 'Upcoming', filter: (t) => t.status === 'overdue' },
      { label: 'Open', filter: (t) => t.status === 'open' },
      { label: 'Completed today', filter: (t) => t.status === 'completed' },
    ];

    for (const section of sections) {
      const items = this.todos.filter(section.filter);
      if (items.length === 0) continue;

      const label = document.createElement('div');
      label.className = 'todo-section-label';
      label.textContent = section.label;
      this.listEl.appendChild(label);

      for (const todo of items) {
        this.listEl.appendChild(this.renderItem(todo));
      }
    }

    this.updateCount();
  }
}

// ─── ChatArea ─────────────────────────────────────────────────────────────────

class ChatArea {
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById('chatArea')!;
    this.appendDivider('Today');
    this.loadSeedMessages();
  }

  private loadSeedMessages(): void {
    this.append({
      time: '09:14',
      type: 'log',
      typeLabel: 'Log entry',
      content: '<ul><li>Reviewed and approved the authentication PR from Sarah</li><li>Fixed the session timeout bug introduced in v2.1.3</li><li>Attended morning standup — discussed sprint blockers</li></ul>',
      rawInput: 'reviewed sarahs pr approved it, fixed that session bug from last week, standup was about blockers',
    });
    this.append({
      time: '10:32',
      type: 'todo-created',
      typeLabel: 'Todo created',
      content: 'Write unit tests for the new payment webhook handler',
    });
    this.append({
      time: '10:33',
      type: 'todo-created',
      typeLabel: 'Todo created — due Feb 24',
      content: 'Send updated API documentation to the mobile team',
    });
    this.append({
      time: '14:05',
      type: 'log',
      typeLabel: 'Log entry',
      content: '<ul><li>Completed code review for the dashboard redesign feature branch</li><li>Had a 1:1 with the PM to align on Q2 priorities</li></ul>',
      rawInput: 'did the code review for dashboard branch, 1on1 with pm about q2 stuff',
    });
    this.append({
      time: '14:06',
      type: 'system',
      typeLabel: 'System',
      content: 'Marked <span style="color:var(--text)">"Update staging environment config"</span> as complete.',
    });
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
    this.render();
  }

  private render(): void {
    const now = new Date();
    this.monthLabel.textContent = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const days = (offset: number): DayEntry => {
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      return { date: d, preview: '', logCount: 0, todoDoneCount: 0 };
    };

    const seedEntries: DayEntry[] = [
      { date: days(0).date, preview: 'Reviewed PR, fixed auth bug, standup call', logCount: 3, todoDoneCount: 2 },
      { date: days(1).date, preview: 'Deployed v2.1 to staging, wrote tests for payment module', logCount: 2, todoDoneCount: 0 },
      { date: days(2).date, preview: 'Architecture review with team, updated API docs', logCount: 4, todoDoneCount: 1 },
      { date: days(3).date, preview: 'Debugging session, customer call, updated roadmap', logCount: 2, todoDoneCount: 0 },
      { date: days(4).date, preview: 'Sprint planning, ticket grooming, fixed CI pipeline', logCount: 3, todoDoneCount: 0 },
    ];

    seedEntries.forEach((entry, index) => {
      this.dayList.appendChild(this.renderEntry(entry, index === 0));
    });
  }

  private renderEntry(entry: DayEntry, active: boolean): HTMLElement {
    const dowNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dow = dowNames[entry.date.getDay()];
    const day = entry.date.getDate();

    const metaTags: string[] = [];
    if (entry.logCount > 0) {
      metaTags.push(`<span class="tag tag-log">${entry.logCount} entries</span>`);
    }
    if (entry.todoDoneCount > 0) {
      metaTags.push(`<span class="tag tag-todo">${entry.todoDoneCount} done</span>`);
    }

    const el = document.createElement('div');
    el.className = `day-entry${active ? ' active' : ''}`;
    el.innerHTML = `
      <div class="day-entry-date">
        <div class="day-entry-dow">${dow}</div>
        <div class="day-entry-num">${day}</div>
      </div>
      <div>
        <div class="day-entry-preview">${entry.preview}</div>
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
  private onSubmit: (value: string) => void;

  constructor(onSubmit: (value: string) => void) {
    this.input = document.getElementById('chatInput') as HTMLTextAreaElement;
    this.onSubmit = onSubmit;

    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.getElementById('sendBtn')!.addEventListener('click', () => this.submit());
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
      this.submit();
    }
  }

  private submit(): void {
    const value = this.input.value.trim();
    if (!value) return;
    this.onSubmit(value);
    this.input.value = '';
    this.input.style.height = 'auto';
    this.input.classList.remove('is-command');
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

class App {
  private chatArea: ChatArea;
  private todoPanel: TodoPanel;
  private modal: LogModal;
  constructor() {
    this.chatArea = new ChatArea();
    this.todoPanel = new TodoPanel();
    this.modal = new LogModal();
    new Sidebar();

    this.initHeader();
    new InputHandler((value) => this.handleInput(value));
  }

  private initHeader(): void {
    const dateEl = document.getElementById('headerDate')!;
    dateEl.textContent = new Date().toLocaleString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    document.getElementById('sidebarToggleBtn')!.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('viewLogBtn')!.addEventListener('click', () => this.openLogModal());
  }

  private toggleSidebar(): void {
    const app = document.getElementById('app')!;
    const btn = document.getElementById('sidebarToggleBtn')!;
    app.classList.toggle('sidebar-collapsed');
    btn.classList.toggle('active');
  }

  private openLogModal(): void {
    this.modal.open([
      {
        date: 'Saturday, Feb 21',
        items: [
          { text: 'Reviewed and approved the authentication PR from Sarah', time: '09:14' },
          { text: 'Fixed the session timeout bug introduced in v2.1.3', time: '09:14' },
          { text: 'Attended morning standup — discussed sprint blockers', time: '09:14' },
          { text: 'Completed code review for the dashboard redesign feature branch', time: '14:05' },
          { text: 'Had a 1:1 with the PM to align on Q2 priorities', time: '14:05' },
        ],
      },
      {
        date: 'Friday, Feb 20',
        items: [
          { text: 'Deployed v2.1 to staging environment after final QA sign-off', time: '11:20' },
          { text: 'Wrote integration tests for the payment module checkout flow', time: '15:45' },
        ],
      },
      {
        date: 'Thursday, Feb 19',
        items: [
          { text: 'Led architecture review session with the backend team', time: '10:00' },
          { text: 'Updated API documentation with new endpoint schemas', time: '13:30' },
          { text: 'Reviewed and merged two PRs from the frontend team', time: '16:00' },
          { text: 'Triaged open bugs from the weekly bug bash session', time: '17:10' },
        ],
      },
    ]);
  }

  private handleInput(value: string): void {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    if (value.startsWith('/todo')) {
      const text = value.replace('/todo', '').trim();
      this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo created', content: text });
      this.todoPanel.add(text);
    } else if (value.startsWith('/done')) {
      const task = value.replace('/done', '').trim();
      this.chatArea.append({
        time, type: 'system', typeLabel: 'System',
        content: `Marked <span style="color:var(--text)">"${task}"</span> as complete.`,
      });
    } else if (value.startsWith('/important')) {
      const text = value.replace('/important', '').trim();
      this.chatArea.append({ time, type: 'todo-created', typeLabel: 'Todo prioritized', content: text });
      this.todoPanel.add(text, 'important');
    } else {
      this.chatArea.append({
        time, type: 'log', typeLabel: 'Log entry',
        content: `<ul><li>${value}</li></ul>`,
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
