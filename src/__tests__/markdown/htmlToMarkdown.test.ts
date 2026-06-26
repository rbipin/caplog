import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../../markdown/htmlToMarkdown';

describe('htmlToMarkdown', () => {
  it('converts a <ul> into dash bullets', () => {
    expect(htmlToMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b');
  });

  it('unwraps a <p> to its text', () => {
    expect(htmlToMarkdown('<p>x</p>')).toBe('x');
  });

  it('converts <strong> to **bold**', () => {
    expect(htmlToMarkdown('<ul><li><strong>Big</strong> news</li></ul>')).toBe('- **Big** news');
  });

  it('converts <em> to *italic*', () => {
    expect(htmlToMarkdown('<p><em>note</em></p>')).toBe('*note*');
  });

  it('handles nested lists with indentation', () => {
    const html = '<ul><li>parent<ul><li>child</li></ul></li></ul>';
    expect(htmlToMarkdown(html)).toBe('- parent\n  - child');
  });

  it('decodes HTML entities from the legacy escapeHtml path', () => {
    expect(htmlToMarkdown('<ul><li>a &amp; b &lt;c&gt;</li></ul>')).toBe('- a & b <c>');
  });

  it('separates multiple block elements with a blank line', () => {
    expect(htmlToMarkdown('<p>one</p><p>two</p>')).toBe('one\n\ntwo');
  });

  it('passes plain text / existing markdown through unchanged (idempotent)', () => {
    expect(htmlToMarkdown('- a\n- b')).toBe('- a\n- b');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});
