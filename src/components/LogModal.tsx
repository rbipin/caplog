import { useEffect } from 'react';
import { useAllLogEntries, useLogEntriesByDate } from '../hooks/useLogEntries';
import { useCompletedTodos } from '../hooks/useTodos';
import { buildDayLogs } from '../logAggregation.js';
import { exportMarkdown } from '../export.js';
import { formatTime, parseLocalDate } from '../utils.js';
import { Markdown } from './Markdown';
import type { TodoItem } from '../types.js';

export interface LogModalProps {
  /** `null` → month view (all entries); a date string → single-day view. */
  day: string | null;
  onClose: () => void;
}

export function LogModal({ day, onClose }: LogModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay visible"
      id="logModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        {day === null ? <MonthView /> : <DayView day={day} />}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={() => void exportMarkdown()}>
            ↗ Export .md
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ subtitle, onClose }: { subtitle: string; onClose?: () => void }) {
  return (
    <div className="modal-header">
      <div>
        <div className="modal-title">CapLog</div>
        <div className="modal-subtitle" id="modalSubtitle">
          {subtitle}
        </div>
      </div>
      {onClose && (
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
}

function MonthView() {
  const { data: entries = [] } = useAllLogEntries();
  const { data: completed = [] } = useCompletedTodos();
  const now = new Date();
  const subtitle = `Log entries — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;

  const days = buildDayLogs(entries, completed).map((d) => ({
    label: parseLocalDate(d.date).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    items: d.items,
    completedTodos: d.completedTodos,
  }));

  return (
    <>
      <Header subtitle={subtitle} />
      <div className="modal-body" id="modalBody">
        {days.map((d) => (
          <div className="log-view-entry" key={d.label}>
            <div className="log-view-date">{d.label}</div>
            {d.items.map((item, i) => (
              <div className="log-view-item" key={i}>
                <Markdown>{item.text}</Markdown>
                <span className="log-view-time">{item.time}</span>
              </div>
            ))}
            <CompletedTodos todos={d.completedTodos} withSubhead />
          </div>
        ))}
      </div>
    </>
  );
}

function DayView({ day }: { day: string }) {
  const { data: entries = [] } = useLogEntriesByDate(day);
  const { data: completed = [] } = useCompletedTodos();
  const dayCompleted = completed.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === day);
  const subtitle = parseLocalDate(day).toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <Header subtitle={subtitle} />
      <div className="modal-body" id="modalBody">
        {entries.length > 0 && (
          <div className="log-view-entry">
            <div className="log-view-date">Log Entries</div>
            {entries.map((e) => (
              <div className="log-view-item" key={e.id}>
                <Markdown>{e.formatted_text}</Markdown>
                <span className="log-view-time">{formatTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
        {dayCompleted.length > 0 && (
          <div className="log-view-entry">
            <div className="log-view-date">Completed Todos</div>
            <CompletedTodos todos={dayCompleted} />
          </div>
        )}
      </div>
    </>
  );
}

function CompletedTodos({ todos, withSubhead }: { todos: TodoItem[]; withSubhead?: boolean }) {
  if (todos.length === 0) return null;
  return (
    <>
      {withSubhead && <div className="log-view-subhead">Completed Todos</div>}
      {todos.map((t) => (
        <div className="log-view-item log-view-todo" key={t.id}>
          ✓ <Markdown inline>{t.text}</Markdown>
        </div>
      ))}
    </>
  );
}
