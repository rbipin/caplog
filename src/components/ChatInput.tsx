import { useRef, useState } from 'react';

const COMMANDS = ['/todo', '/done', '/important', '/by'] as const;

export interface ChatInputProps {
  onSubmit: (value: string) => void | Promise<void>;
  loading: boolean;
}

export function ChatInput({ onSubmit, loading }: ChatInputProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const isCommand = COMMANDS.some((cmd) => value.trimStart().startsWith(cmd));

  const autoResize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const submit = async () => {
    const v = value.trim();
    if (!v) return;
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
    try {
      await onSubmit(v);
    } catch (err) {
      console.error('handleInput error:', err);
    }
  };

  return (
    <div className="input-area">
      <div className="input-hint">
        Just type to log · <span>/todo</span> new task · <span>/done</span> complete ·{' '}
        <span>/important</span> prioritize · <span>/by [date]</span> set deadline
      </div>
      <div className="input-row">
        <textarea
          ref={ref}
          className={`chat-input${isCommand ? ' is-command' : ''}`}
          placeholder="What did you work on today..."
          rows={1}
          value={value}
          disabled={loading}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button className="send-btn" disabled={loading} onClick={() => void submit()}>
          {loading ? '...' : '↑'}
        </button>
      </div>
    </div>
  );
}
