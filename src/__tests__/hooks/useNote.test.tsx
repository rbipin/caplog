import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeTestQueryClient } from '../testUtils';

const { getNoteMock, saveNoteMock } = vi.hoisted(() => ({
  getNoteMock: vi.fn(),
  saveNoteMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/notesRepo', () => ({
  notesRepo: { getNote: getNoteMock, saveNote: saveNoteMock },
}));

import { useNote, useSaveNote } from '../../hooks/useNote';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('note hooks', () => {
  it('useNote returns the repo content', async () => {
    getNoteMock.mockResolvedValue('existing text');
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useNote(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('existing text');
  });

  it('useSaveNote calls the repo and invalidates the note query', async () => {
    getNoteMock.mockResolvedValue('old');
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ note: useNote(), save: useSaveNote() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
    expect(getNoteMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.save.mutateAsync('new content');
    });

    expect(saveNoteMock).toHaveBeenCalledWith('new content');
    await waitFor(() => expect(getNoteMock).toHaveBeenCalledTimes(2));
  });
});
