import { useQuery } from '@tanstack/react-query';
import { logEntriesRepo } from '../data/logEntriesRepo';
import { queryKeys } from './queryKeys';

export function useDayStats(days: number) {
  return useQuery({
    queryKey: queryKeys.dayStats(days),
    queryFn: () => logEntriesRepo.listDayStats(days),
  });
}
