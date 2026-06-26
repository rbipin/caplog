import { useState } from 'react';
import { useAppConfig } from '../app/AppConfigContext';
import { useRecentLogEntries, useUpdateLogEntry, useDeleteLogEntry } from '../hooks/useLogEntries';
import { useTodos } from '../hooks/useTodos';
import { buildFeed, type FeedItem } from '../feed.js';
import { formatLogEntry } from '../ai.js';
import { formatTime, parseLocalDate } from '../utils.js';
import { Markdown } from './Markdown';
import type { LogEntry, TodoItem } from '../types.js';

export interface Notice {
  id: number;
  time: string;
  content: string;
}

function dayLabels(date: string, today: string): { label: string; sub: string } {
  const d = parseLocalDate(date);
  const diffDays = Math.round((parseLocalDate(today).getTime() - d.getTime()) / 86400000);
  const label =
    diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : d.toLocaleString('en-US', { weekday: 'long' });
  const sub = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  return { label, sub };
}

export function ChatArea({ notices }: { notices: Notice[] }) {
  const { chatDays, currentDate } = useAppConfig();
  const { data: entries = [] } = useRecentLogEntries(chatDays);
  const { data: todos = [] } = useTodos(chatDays);
  const days = buildFeed(entries, todos, currentDate);

  return (
    <div className="chat-area" id="chatArea">
      {days.map((day) => {
        const { label, sub } = dayLabels(day.date, currentDate);
        return (
          <details className="day-section" key={day.date} open={day.isToday}>
            <summary>
              <div className="day-divider">
                <div className="day-divider-line" />
                <div className="day-divider-label">
                  {label} — {sub}
                </div>
                <div className="day-divider-line" />
              </div>
            </summary>
            {day.items.map((item) => (
              <FeedRow key={feedKey(item)} item={item} />
            ))}
            {day.isToday &&
              notices.map((n) => (
                <SystemMessage key={`notice-${n.id}`} time={n.time} content={n.content} />
              ))}
          </details>
        );
      })}
    </div>
  );
}

function feedKey(item: FeedItem): string {
  if (item.kind === 'log') return `log-${item.entry.id}`;
  return `todo-${item.todo.id}-${item.kind}`;
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === 'log') return <LogMessage entry={item.entry} />;
  if (item.kind === 'todo-created') return <TodoCreatedMessage todo={item.todo} />;
  return <TodoCompletedMessage todo={item.todo} sortKey={item.sortKey} />;
}

function TodoCreatedMessage({ todo }: { todo: TodoItem }) {
  const label = todo.deadline ? `Todo created — due ${todo.deadline}` : 'Todo created';
  return (
    <Message time={formatTime(todo.created_at)} typeClass="todo-created" typeLabel={label}>
      <Markdown inline>{todo.text}</Markdown>
    </Message>
  );
}

function TodoCompletedMessage({ todo, sortKey }: { todo: TodoItem; sortKey: string }) {
  const label = todo.deadline ? `Todo completed — was due ${todo.deadline}` : 'Todo completed';
  return (
    <Message time={formatTime(sortKey)} typeClass="todo-completed" typeLabel={label}>
      <s>
        <Markdown inline>{todo.text}</Markdown>
      </s>
    </Message>
  );
}

function SystemMessage({ time, content }: { time: string; content: string }) {
  return (
    <Message time={time} typeClass="system" typeLabel="System">
      {content}
    </Message>
  );
}

function Message({
  time,
  typeClass,
  typeLabel,
  children,
  editable,
  onContentClick,
  extra,
}: {
  time: string;
  typeClass: string;
  typeLabel: string;
  children: React.ReactNode;
  editable?: boolean;
  onContentClick?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="msg">
      <div className="msg-time">{time}</div>
      <div className="msg-body">
        <div className={`msg-type ${typeClass}`}>{typeLabel}</div>
        <div
          className="msg-content"
          data-editable={editable ? 'true' : undefined}
          onClick={onContentClick}
        >
          {children}
        </div>
        {extra}
      </div>
    </div>
  );
}

function LogMessage({ entry }: { entry: LogEntry }) {
  const { adapter } = useAppConfig();
  const update = useUpdateLogEntry();
  const del = useDeleteLogEntry();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.raw_text);

  const showRaw = !!entry.raw_text && entry.raw_text !== entry.formatted_text;

  const save = async () => {
    const next = draft.trim();
    if (!next) return;
    let formatted = `- ${next}`;
    if (adapter) {
      try {
        formatted = await formatLogEntry(next, adapter);
      } catch {
        // fall through to raw markdown
      }
    }
    await update.mutateAsync({ id: entry.id, rawText: next, formattedText: formatted });
    setEditing(false);
  };

  return (
    <div className="msg">
      <div className="msg-time">{formatTime(entry.created_at)}</div>
      <div className="msg-body">
        <div className="msg-type log">Log entry</div>
        <div
          className="msg-content"
          data-editable="true"
          onClick={() => {
            if (!editing) {
              setDraft(entry.raw_text);
              setEditing(true);
            }
          }}
        >
          {editing ? (
            <>
              <textarea
                className="msg-edit-area"
                autoFocus
                value={draft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="msg-edit-actions">
                <button
                  className="msg-edit-save"
                  disabled={update.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    void save();
                  }}
                >
                  {update.isPending ? '...' : 'Save'}
                </button>
                <button
                  className="msg-edit-cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <Markdown>{entry.formatted_text}</Markdown>
          )}
        </div>
        {showRaw && !editing && (
          <div className="msg-raw">
            <div className="msg-raw-label">Original input</div>
            {entry.raw_text}
          </div>
        )}
      </div>
      <button
        className="msg-delete-btn"
        title="Delete entry"
        onClick={(e) => {
          e.stopPropagation();
          void del.mutateAsync(entry.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
