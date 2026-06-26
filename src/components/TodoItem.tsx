import { useState } from 'react';
import { todoStatus } from '../todoLogic.js';
import { Markdown } from './Markdown';
import {
  useCompleteTodo,
  useReopenTodo,
  useDeleteTodo,
  useSetTodoImportant,
  useSetTodoDeadline,
  useUpdateTodoText,
} from '../hooks/useTodos';
import type { TodoItem as Todo } from '../types.js';

type EditMode = 'none' | 'text' | 'meta';

export function TodoItem({ todo }: { todo: Todo }) {
  const status = todoStatus(todo);
  const completed = status === 'completed';
  const [edit, setEdit] = useState<EditMode>('none');
  const [textDraft, setTextDraft] = useState(todo.text);
  const [deadlineDraft, setDeadlineDraft] = useState(todo.deadline ?? '');

  const complete = useCompleteTodo();
  const reopen = useReopenTodo();
  const del = useDeleteTodo();
  const setImportant = useSetTodoImportant();
  const setDeadline = useSetTodoDeadline();
  const updateText = useUpdateTodoText();

  const openTextEdit = () => {
    setTextDraft(todo.text);
    setEdit('text');
  };
  const openMetaEdit = () => {
    setDeadlineDraft(todo.deadline ?? '');
    setEdit('meta');
  };

  const saveText = async () => {
    const next = textDraft.trim();
    if (!next) return;
    await updateText.mutateAsync({ id: todo.id, text: next });
    setEdit('none');
  };

  const saveDeadline = async () => {
    await setDeadline.mutateAsync({ id: todo.id, deadline: deadlineDraft.trim() || null });
    setEdit('none');
  };

  const onRootClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (completed || edit !== 'none') return;
    const target = e.target as HTMLElement;
    if (
      target.closest('.todo-delete-btn') ||
      target.closest('.todo-text') ||
      target.closest('.todo-chips') ||
      target.closest('.todo-meta-edit')
    ) {
      return;
    }
    void complete.mutateAsync(todo.id);
  };

  return (
    <div className={`todo-item${status !== 'open' ? ` ${status}` : ''}`} onClick={onRootClick}>
      <div
        className="todo-check"
        style={completed ? { cursor: 'pointer' } : undefined}
        onClick={(e) => {
          if (!completed) return;
          e.stopPropagation();
          void reopen.mutateAsync(todo.id);
        }}
      >
        {completed && <span className="completed-check">✓</span>}
      </div>

      <div className="todo-content">
        <div className="todo-text" style={completed ? undefined : { cursor: 'text' }}>
          {edit === 'text' ? (
            <>
              <textarea
                className="todo-edit-area"
                autoFocus
                value={textDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void saveText();
                  }
                  if (e.key === 'Escape') setEdit('none');
                }}
              />
              <div className="todo-edit-actions">
                <button
                  className="todo-edit-save"
                  disabled={updateText.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    void saveText();
                  }}
                >
                  {updateText.isPending ? '...' : 'Save'}
                </button>
                <button
                  className="todo-edit-cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEdit('none');
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <span
              onClick={(e) => {
                if (completed) return;
                e.stopPropagation();
                openTextEdit();
              }}
            >
              <Markdown inline>{todo.text}</Markdown>
            </span>
          )}
        </div>

        <TodoMeta todo={todo} status={status} />

        {!completed && (
          <div className="todo-chips">
            <span
              className={`todo-chip ${todo.deadline ? 'filled' : 'ghost'}`}
              data-chip="deadline"
              onClick={(e) => {
                e.stopPropagation();
                openMetaEdit();
              }}
            >
              {todo.deadline ? `due ${todo.deadline}` : '+ due date'}
            </span>
            <span
              className={`todo-chip ${todo.is_important ? 'filled important' : 'ghost'}`}
              data-chip="importance"
              onClick={(e) => {
                e.stopPropagation();
                void setImportant.mutateAsync({ id: todo.id, value: !todo.is_important });
              }}
            >
              {todo.is_important ? '★ important' : '☆ important'}
            </span>
          </div>
        )}

        {edit === 'meta' && (
          <div className="todo-meta-edit" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="due date (e.g. Jun 15)"
              autoFocus
              value={deadlineDraft}
              onChange={(e) => setDeadlineDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveDeadline();
                if (e.key === 'Escape') setEdit('none');
              }}
            />
            <button
              className="todo-meta-save"
              disabled={setDeadline.isPending}
              onClick={() => void saveDeadline()}
            >
              {setDeadline.isPending ? '...' : 'Save'}
            </button>
            <button className="todo-meta-cancel" onClick={() => setEdit('none')}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <button
        className="todo-delete-btn"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          void del.mutateAsync(todo.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}

function TodoMeta({ todo, status }: { todo: Todo; status: ReturnType<typeof todoStatus> }) {
  const showOverdue = status === 'overdue';
  if (!todo.deadline && !showOverdue) return null;
  return (
    <div className="todo-meta">
      {todo.deadline && (
        <span className={`todo-deadline${showOverdue ? ' overdue' : ''}`}>{todo.deadline}</span>
      )}
      {showOverdue && <span className="todo-badge overdue">overdue</span>}
    </div>
  );
}
