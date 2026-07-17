import { useRef, useState } from 'react';
import { useAppConfig } from './AppConfigContext';
import { useInsertLogEntry } from '../hooks/useLogEntries';
import { useAddTodo, useCompleteTodoByText } from '../hooks/useTodos';
import { ChatArea, type Notice } from '../components/ChatArea';
import { ChatInput } from '../components/ChatInput';
import { Sidebar } from '../components/Sidebar';
import { TodoPanel } from '../components/TodoPanel';
import { LogModal } from '../components/LogModal';
import { SettingsModal } from '../components/SettingsModal';
import { ArchiveModal } from '../components/ArchiveModal';
import { NotesModal } from '../components/NotesModal';
import { parseCommand } from '../commands.js';
import { formatLogEntry } from '../ai.js';
import { exportMarkdown } from '../export.js';
import { getToday } from '../utils.js';

type ModalState =
  | { kind: 'none' }
  | { kind: 'log'; day: string | null }
  | { kind: 'settings' }
  | { kind: 'archive' }
  | { kind: 'notes' };

export function App() {
  const { adapter } = useAppConfig();
  const insertLog = useInsertLogEntry();
  const addTodo = useAddTodo();
  const completeByText = useCompleteTodoByText();

  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const noticeId = useRef(0);

  const headerDate = new Date().toLocaleString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function pushNotice(content: string) {
    const now = new Date();
    const time =
      now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    setNotices((prev) => [...prev, { id: noticeId.current++, time, content }]);
  }

  async function handleSubmit(value: string) {
    const cmd = parseCommand(value);

    if (cmd.type === 'log') {
      const today = getToday();
      let formatted = `- ${cmd.text}`;
      if (adapter) {
        setLoading(true);
        try {
          formatted = await formatLogEntry(cmd.text, adapter);
        } catch (err) {
          console.error('AI format failed:', err);
          pushNotice('AI formatting failed — saved raw text.');
        } finally {
          setLoading(false);
        }
      }
      await insertLog.mutateAsync({ date: today, rawText: cmd.text, formattedText: formatted });
    } else if (cmd.type === 'todo') {
      await addTodo.mutateAsync({ text: cmd.text, deadline: cmd.deadline });
    } else if (cmd.type === 'important') {
      await addTodo.mutateAsync({ text: cmd.text, isImportant: true });
    } else if (cmd.type === 'done') {
      const found = await completeByText.mutateAsync(cmd.task);
      pushNotice(
        found
          ? `Marked "${cmd.task}" as complete.`
          : `No active todo matching "${cmd.task}" found.`
      );
    }
  }

  return (
    <div className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} id="app">
      <header className="header">
        <button
          className={`sidebar-toggle${sidebarCollapsed ? ' active' : ''}`}
          id="sidebarToggleBtn"
          title="Toggle log history"
          onClick={() => setSidebarCollapsed((c) => !c)}
        >
          ☰
        </button>
        <div className="header-logo">CapLog</div>
        <AiPill active={!!adapter} />
        <div className="header-date" id="headerDate">
          {headerDate}
        </div>
        <div className="header-actions">
          <button className="btn-ghost" id="viewLogBtn" onClick={() => setModal({ kind: 'log', day: null })}>
            ⊞ View Log
          </button>
          <button className="btn-ghost" id="notesBtn" onClick={() => setModal({ kind: 'notes' })}>
            📝 Notes
          </button>
          <button className="btn-ghost" id="exportBtn" onClick={() => void exportMarkdown()}>
            ↗ Export .md
          </button>
          <button className="btn-ghost" id="settingsBtn" onClick={() => setModal({ kind: 'settings' })}>
            ⚙ Settings
          </button>
        </div>
      </header>

      <Sidebar
        onDaySelect={(date) => setModal({ kind: 'log', day: date })}
        onOpenArchive={() => setModal({ kind: 'archive' })}
      />

      <main className="main">
        <ChatArea notices={notices} />
        <ChatInput onSubmit={handleSubmit} loading={loading} />
      </main>

      <TodoPanel />

      {modal.kind === 'log' && (
        <LogModal day={modal.day} onClose={() => setModal({ kind: 'none' })} />
      )}
      {modal.kind === 'settings' && <SettingsModal onClose={() => setModal({ kind: 'none' })} />}
      {modal.kind === 'archive' && (
        <ArchiveModal
          onDaySelect={(date) => setModal({ kind: 'log', day: date })}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}
      {modal.kind === 'notes' && <NotesModal onClose={() => setModal({ kind: 'none' })} />}
    </div>
  );
}

function AiPill({ active }: { active: boolean }) {
  if (active) {
    return (
      <span id="aiStatusPill" className="pill pill-green">
        <span className="pill-dot" />
        AI Active
      </span>
    );
  }
  return (
    <span id="aiStatusPill" className="pill pill-yellow">
      <span className="pill-icon">⚠</span>
      No AI
    </span>
  );
}
