import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logEntriesRepo } from '../data/logEntriesRepo';
import { queryKeys } from './queryKeys';
import type { LogEntry } from '../types.js';

export function useRecentLogEntries(days: number) {
  return useQuery({
    queryKey: queryKeys.recentLogEntries(days),
    queryFn: () => logEntriesRepo.listRecent(days),
  });
}

export function useAllLogEntries() {
  return useQuery({
    queryKey: queryKeys.allLogEntries(),
    queryFn: () => logEntriesRepo.listAll(),
  });
}

export function useLogEntriesByDate(date: string | null) {
  return useQuery({
    queryKey: queryKeys.logEntriesByDate(date ?? ''),
    queryFn: () => logEntriesRepo.getByDate(date as string),
    enabled: !!date,
  });
}

/** Invalidates everything derived from log entries. */
function useInvalidateLogEntries() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.logEntries });
    qc.invalidateQueries({ queryKey: ['dayStats'] });
  };
}

export function useInsertLogEntry() {
  const invalidate = useInvalidateLogEntries();
  return useMutation({
    mutationFn: (input: { date: string; rawText: string; formattedText: string }) =>
      logEntriesRepo.insert(input.date, input.rawText, input.formattedText),
    onSuccess: invalidate,
  });
}

export function useUpdateLogEntry() {
  const invalidate = useInvalidateLogEntries();
  return useMutation({
    mutationFn: (input: { id: number; rawText: string; formattedText: string }) =>
      logEntriesRepo.update(input.id, input.rawText, input.formattedText),
    onSuccess: invalidate,
  });
}

export function useDeleteLogEntry() {
  const invalidate = useInvalidateLogEntries();
  return useMutation({
    mutationFn: (id: number) => logEntriesRepo.remove(id),
    onSuccess: invalidate,
  });
}

export type { LogEntry };
