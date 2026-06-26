/**
 * One-time HTML → Markdown converter for migrating legacy `log_entries.formatted_text`
 * rows (the only HTML CapLog ever stored). Handles the known subset:
 * `<ul>/<ol>/<li>` (including nesting), `<p>`, `<strong>/<b>`, `<em>/<i>`, `<br>`.
 *
 * This is a throwaway helper — deletable once every install has migrated. It is
 * effectively idempotent: plain text / existing Markdown passes through unchanged.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return serializeBlocks(doc.body).replace(/\n{3,}/g, '\n\n').trim();
}

function serializeBlocks(parent: Node): string {
  const blocks: string[] = [];

  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3 /* text */) {
      const text = (node.textContent ?? '').trim();
      if (text) blocks.push(text);
      return;
    }
    if (node.nodeType !== 1 /* element */) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'ul' || tag === 'ol') {
      blocks.push(renderList(el, 0).join('\n'));
    } else if (tag === 'p' || tag === 'div') {
      const inner = renderInline(el).trim();
      if (inner) blocks.push(inner);
    } else {
      const inner = renderInline(el).trim();
      if (inner) blocks.push(inner);
    }
  });

  return blocks.filter(Boolean).join('\n\n');
}

function renderList(list: Element, depth: number): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  list.childNodes.forEach((node) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName.toLowerCase() !== 'li') return;

    let inline = '';
    const nested: string[] = [];
    el.childNodes.forEach((child) => {
      if (child.nodeType === 1) {
        const childEl = child as Element;
        const childTag = childEl.tagName.toLowerCase();
        if (childTag === 'ul' || childTag === 'ol') {
          nested.push(...renderList(childEl, depth + 1));
          return;
        }
      }
      inline += renderInline(child);
    });

    lines.push(`${indent}- ${inline.trim()}`);
    lines.push(...nested);
  });

  return lines;
}

function renderInline(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  if (node.nodeType !== 1) return '';

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(renderInline).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return `**${inner}**`;
    case 'em':
    case 'i':
      return `*${inner}*`;
    case 's':
    case 'del':
    case 'strike':
      return `~~${inner}~~`;
    case 'br':
      return '\n';
    case 'a': {
      const href = el.getAttribute('href');
      return href ? `[${inner}](${href})` : inner;
    }
    default:
      return inner;
  }
}
