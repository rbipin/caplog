import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../testUtils';
import { getToday } from '../../utils.js';

const { listRecentMock, listTodosMock, getChatDaysMock, getAdapterMock } = vi.hoisted(() => ({
  listRecentMock: vi.fn().mockResolvedValue([]),
  listTodosMock: vi.fn().mockResolvedValue([]),
  getChatDaysMock: vi.fn().mockResolvedValue(3),
  getAdapterMock: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../data/logEntriesRepo', () => ({
  logEntriesRepo: { listRecent: listRecentMock },
}));
vi.mock('../../data/todosRepo', () => ({
  todosRepo: { list: listTodosMock },
}));
vi.mock('../../data/settingsRepo', () => ({
  settingsRepo: { getChatDays: getChatDaysMock },
}));
vi.mock('../../llm/factory.js', () => ({
  getAdapter: getAdapterMock,
  runLLMMigration: vi.fn().mockResolvedValue(undefined),
}));

import { ChatArea } from '../../components/ChatArea';

beforeEach(() => {
  vi.clearAllMocks();
  getChatDaysMock.mockResolvedValue(3);
  getAdapterMock.mockResolvedValue(null);
});

describe('ChatArea', () => {
  it('renders a log entry as Markdown in the feed', async () => {
    const today = getToday();
    listRecentMock.mockResolvedValue([
      {
        id: 1,
        date: today,
        raw_text: 'shipped feature',
        formatted_text: '- **shipped** feature',
        created_at: `${today}T09:30:00.000`,
      },
    ]);
    listTodosMock.mockResolvedValue([]);

    renderWithProviders(<ChatArea notices={[]} />);

    await waitFor(() => expect(screen.getByText('shipped')).toBeTruthy());
    expect(screen.getByText('shipped').tagName).toBe('STRONG');
    expect(screen.getByText('Log entry')).toBeTruthy();
  });

  it('renders an open todo as Todo created', async () => {
    const today = getToday();
    listRecentMock.mockResolvedValue([]);
    listTodosMock.mockResolvedValue([
      {
        id: 5,
        text: 'call dentist',
        is_important: 0,
        is_completed: 0,
        deadline: null,
        created_at: `${today}T08:00:00.000`,
        completed_at: null,
      },
    ]);

    renderWithProviders(<ChatArea notices={[]} />);

    await waitFor(() => expect(screen.getByText('call dentist')).toBeTruthy());
    expect(screen.getByText('Todo created')).toBeTruthy();
  });

  it('renders today-only ephemeral notices', async () => {
    listRecentMock.mockResolvedValue([]);
    listTodosMock.mockResolvedValue([]);

    renderWithProviders(
      <ChatArea notices={[{ id: 1, time: '10:00', content: 'Marked "x" as complete.' }]} />
    );

    await waitFor(() => expect(screen.getByText('Marked "x" as complete.')).toBeTruthy());
    expect(screen.getByText('System')).toBeTruthy();
  });
});
