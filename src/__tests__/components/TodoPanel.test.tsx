import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../testUtils';

const { listTodosMock, completeTodoMock, getChatDaysMock, getAdapterMock } = vi.hoisted(() => ({
  listTodosMock: vi.fn().mockResolvedValue([]),
  completeTodoMock: vi.fn().mockResolvedValue(undefined),
  getChatDaysMock: vi.fn().mockResolvedValue(3),
  getAdapterMock: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../data/todosRepo', () => ({
  todosRepo: { list: listTodosMock, completeTodo: completeTodoMock },
}));
vi.mock('../../data/settingsRepo', () => ({
  settingsRepo: { getChatDays: getChatDaysMock },
}));
vi.mock('../../llm/factory.js', () => ({
  getAdapter: getAdapterMock,
  runLLMMigration: vi.fn().mockResolvedValue(undefined),
}));

import { TodoPanel } from '../../components/TodoPanel';

function todo(over = {}) {
  return {
    id: 1,
    text: 'task',
    is_important: 0,
    is_completed: 0,
    deadline: null,
    created_at: '2026-06-26T08:00:00.000',
    completed_at: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getChatDaysMock.mockResolvedValue(3);
  getAdapterMock.mockResolvedValue(null);
});

describe('TodoPanel', () => {
  it('shows open and done counts', async () => {
    listTodosMock.mockResolvedValue([
      todo({ id: 1, text: 'open one' }),
      todo({ id: 2, text: 'done one', is_completed: 1, completed_at: '2026-06-26T10:00:00.000' }),
    ]);
    renderWithProviders(<TodoPanel />);
    await waitFor(() => expect(screen.getByText(/1 open · 1 done/)).toBeTruthy());
  });

  it('groups important todos under the Important section', async () => {
    listTodosMock.mockResolvedValue([todo({ id: 3, text: 'urgent', is_important: 1 })]);
    renderWithProviders(<TodoPanel />);
    await waitFor(() => expect(screen.getByText('urgent')).toBeTruthy());
    expect(screen.getByText('Important')).toBeTruthy();
  });

  it('completes a todo when its check area is clicked', async () => {
    listTodosMock.mockResolvedValue([todo({ id: 7, text: 'finish report' })]);
    const { container } = renderWithProviders(<TodoPanel />);
    await waitFor(() => expect(screen.getByText('finish report')).toBeTruthy());

    const item = container.querySelector('.todo-item') as HTMLElement;
    await userEvent.click(item);

    await waitFor(() => expect(completeTodoMock).toHaveBeenCalledWith(7));
  });
});
