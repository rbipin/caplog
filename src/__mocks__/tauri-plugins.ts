import { vi } from 'vitest';

export function makeSqlMock() {
  const db = {
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    db,
    DatabaseMock: {
      load: vi.fn().mockResolvedValue(db),
    },
  };
}

export function makeDialogMock(returnPath: string | null = '/tmp/export.md') {
  return {
    save: vi.fn().mockResolvedValue(returnPath),
  };
}

export function makeFsMock() {
  return {
    writeTextFile: vi.fn().mockResolvedValue(undefined),
  };
}
