import { type ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Opens links in the system browser instead of navigating the Tauri webview.
 * For a future web build, swap this for a plain `target="_blank"` anchor.
 */
function ExternalLink({ href, children }: ComponentProps<'a'>) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) void openUrl(href).catch((err) => console.error('openUrl failed', err));
      }}
    >
      {children}
    </a>
  );
}

const baseComponents: Components = {
  a: ExternalLink,
};

const inlineComponents: Components = {
  ...baseComponents,
  // Unwrap the outer paragraph so inline content (todos, previews) stays on one line.
  p: ({ children }) => <>{children}</>,
};

export interface MarkdownProps {
  children: string;
  /** Render inline: unwrap the outer <p> so content stays on a single line. */
  inline?: boolean;
  className?: string;
}

/**
 * Canonical Markdown renderer. Raw HTML is intentionally NOT enabled
 * (no `rehype-raw`), so any injected `<script>`/`<img onerror>` in stored
 * content renders inert as text — the security guarantee of the migration.
 */
export function Markdown({ children, inline = false, className }: MarkdownProps) {
  const tree = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={inline ? inlineComponents : baseComponents}
    >
      {children}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={['md', 'md-inline', className].filter(Boolean).join(' ')}>{tree}</span>;
  }
  return <div className={['md', className].filter(Boolean).join(' ')}>{tree}</div>;
}
