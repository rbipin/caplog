import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../testUtils';

const { getNoteMock, saveNoteMock } = vi.hoisted(() => ({
  getNoteMock: vi.fn(),
  saveNoteMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/notesRepo', () => ({
  notesRepo: { getNote: getNoteMock, saveNote: saveNoteMock },
}));

import { NotesModal } from '../../components/NotesModal';

beforeEach(() => {
  vi.clearAllMocks();
  getNoteMock.mockResolvedValue('');
});

describe('NotesModal', () => {
  it('shows a placeholder when the note is empty', async () => {
    getNoteMock.mockResolvedValue('');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());
    expect(screen.getByText(/no scribbles yet/i)).toBeTruthy();
  });

  it('renders existing content as Markdown in view mode', async () => {
    getNoteMock.mockResolvedValue('# Hello\n\nSome scribble');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
    );
  });

  it('clicking the rendered view switches to an editable textarea with raw content', async () => {
    getNoteMock.mockResolvedValue('raw **markdown** text');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('raw **markdown** text');
  });

  it('autosaves 12s after the last change, and not before', async () => {
    getNoteMock.mockResolvedValue('start');
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // Switch to fake timers only after the userEvent-driven setup above,
    // since userEvent's internals rely on real timers for async delays.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await userEvent.type(textarea, ' more', { delay: null });

      await vi.advanceTimersByTimeAsync(11000);
      expect(saveNoteMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1500);
      expect(saveNoteMock).toHaveBeenCalledWith('start more');
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes a pending unsaved change immediately on close', async () => {
    getNoteMock.mockResolvedValue('start');
    const onClose = vi.fn();
    renderWithProviders(<NotesModal onClose={onClose} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.type(textarea, ' more');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(saveNoteMock).toHaveBeenCalledWith('start more'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error status and preserves the draft when save fails', async () => {
    getNoteMock.mockResolvedValue('start');
    saveNoteMock.mockRejectedValueOnce(new Error('fail'));
    renderWithProviders(<NotesModal onClose={() => {}} />);
    await waitFor(() => expect(getNoteMock).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId('notes-view'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await userEvent.type(textarea, ' more', { delay: null });

      await vi.advanceTimersByTimeAsync(12500);
      await waitFor(() => expect(saveNoteMock).toHaveBeenCalledWith('start more'));

      await waitFor(() =>
        expect(screen.getByText(/couldn't save — will retry on next change/i)).toBeTruthy()
      );
      expect(textarea.value).toBe('start more');
    } finally {
      vi.useRealTimers();
    }
  });
});
