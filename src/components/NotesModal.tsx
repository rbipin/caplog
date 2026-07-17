import { useEffect, useRef, useState } from 'react';
import { useNote, useSaveNote } from '../hooks/useNote';
import { Markdown } from './Markdown';

export interface NotesModalProps {
  onClose: () => void;
}

const AUTOSAVE_DELAY_MS = 12000;
const SAVED_MESSAGE_DURATION_MS = 3000;

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function NotesModal({ onClose }: NotesModalProps) {
  const { data: content, isSuccess } = useNote();
  const saveNote = useSaveNote();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const lastSavedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef('');

  useEffect(() => {
    if (isSuccess && content !== undefined) {
      setDraft(content);
      draftRef.current = content;
      lastSavedRef.current = content;
    }
  }, [isSuccess, content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        void handleClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function flushSave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (draftRef.current === lastSavedRef.current) return;
    setStatus('saving');
    try {
      await saveNote.mutateAsync(draftRef.current);
      lastSavedRef.current = draftRef.current;
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), SAVED_MESSAGE_DURATION_MS);
    } catch (err) {
      console.error('Failed to save note:', err);
      setStatus('error');
    }
  }

  function handleChange(value: string) {
    setDraft(value);
    draftRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), AUTOSAVE_DELAY_MS);
  }

  async function handleClose() {
    await flushSave();
    onClose();
  }

  return (
    <div
      className="modal-overlay visible"
      id="notesModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) void handleClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Notes</div>
          </div>
          <button className="modal-close" onClick={() => void handleClose()}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {editing ? (
            <textarea
              className="notes-textarea"
              autoFocus
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
            />
          ) : draft === '' ? (
            <div
              className="notes-placeholder"
              data-testid="notes-view"
              onClick={() => setEditing(true)}
            >
              No scribbles yet — click to start writing.
            </div>
          ) : (
            <div data-testid="notes-view" onClick={() => setEditing(true)}>
              <Markdown>{draft}</Markdown>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {status === 'saving' && <span className="notes-status">Saving…</span>}
          {status === 'saved' && <span className="notes-status">Saved</span>}
          {status === 'error' && (
            <span className="notes-status error">Save failed — will retry</span>
          )}
          <button className="btn-ghost" onClick={() => void handleClose()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
