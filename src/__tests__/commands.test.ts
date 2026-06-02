import { describe, it, expect } from 'vitest';
import { parseCommand } from '../commands.js';

describe('parseCommand', () => {
  it('/todo Buy milk → { type: todo, text: "Buy milk", deadline: null }', () => {
    expect(parseCommand('/todo Buy milk')).toEqual({ type: 'todo', text: 'Buy milk', deadline: null });
  });
  it('/todo Buy milk /by 2026-06-10 → includes deadline', () => {
    expect(parseCommand('/todo Buy milk /by 2026-06-10')).toEqual({ type: 'todo', text: 'Buy milk', deadline: '2026-06-10' });
  });
  it('/todo with no text → empty', () => {
    expect(parseCommand('/todo')).toEqual({ type: 'empty' });
  });
  it('/done task name → { type: done, task: "task name" }', () => {
    expect(parseCommand('/done task name')).toEqual({ type: 'done', task: 'task name' });
  });
  it('/important Fix bug → { type: important, text: "Fix bug" }', () => {
    expect(parseCommand('/important Fix bug')).toEqual({ type: 'important', text: 'Fix bug' });
  });
  it('plain text → { type: log, text: "..." }', () => {
    expect(parseCommand('hello world')).toEqual({ type: 'log', text: 'hello world' });
  });
  it('whitespace-only input → empty', () => {
    expect(parseCommand('   ')).toEqual({ type: 'empty' });
  });
  it('leading whitespace before command is trimmed', () => {
    expect(parseCommand('  /todo Something')).toEqual({ type: 'todo', text: 'Something', deadline: null });
  });
});
