import { describe, it, expect } from 'vitest';
import { escapeHtml, stripHtml } from '../utils.js';

describe('escapeHtml', () => {
  it('escapes &', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes <', () => expect(escapeHtml('<div>')).toBe('&lt;div&gt;'));
  it('escapes >', () => expect(escapeHtml('a > b')).toBe('a &gt; b'));
  it('escapes "', () => expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;'));
  it('leaves unescaped chars unchanged', () => expect(escapeHtml('hello')).toBe('hello'));
});

describe('stripHtml', () => {
  it('returns text content of a simple tag', () => expect(stripHtml('<p>hello</p>')).toBe('hello'));
  it('handles nested tags and returns flattened text', () => expect(stripHtml('<ul><li>a</li><li>b</li></ul>')).toBe('ab'));
});
