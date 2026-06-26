import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../utils.js';

describe('escapeHtml', () => {
  it('escapes &', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes <', () => expect(escapeHtml('<div>')).toBe('&lt;div&gt;'));
  it('escapes >', () => expect(escapeHtml('a > b')).toBe('a &gt; b'));
  it('escapes "', () => expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;'));
  it('leaves unescaped chars unchanged', () => expect(escapeHtml('hello')).toBe('hello'));
});
