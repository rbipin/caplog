import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { makeTestQueryClient } from '../testUtils';

const { listMock, completeMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  completeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/todosRepo', () => ({
  todosRepo: { list: listMock, completeTodo: completeMock },
}));

import { useTodos, useCompleteTodo } from '../../hooks/useTodos';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('todos hooks', () => {
  it('useTodos returns repo data', async () => {
    listMock.mockResolvedValue([{ id: 1, text: 'A' }]);
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTodos(3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 1, text: 'A' }]);
    expect(listMock).toHaveBeenCalledWith(3);
  });

  it('completing a todo invalidates and refetches the todos list', async () => {
    listMock.mockResolvedValue([]);
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ list: useTodos(3), complete: useCompleteTodo() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.complete.mutateAsync(5);
    });

    expect(completeMock).toHaveBeenCalledWith(5);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });
});
