import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { archiveRepo, type ArchiveRange } from '../data/archiveRepo';
import { buildWeeks, type WeekData } from '../archiveUtils.js';

export function useArchiveYear(year: number) {
  return useQuery({
    queryKey: ['archive', 'year', year],
    queryFn: async (): Promise<Map<string, WeekData>> => {
      const [entryCounts, doneCounts] = await Promise.all([
        archiveRepo.yearEntryCounts(year),
        archiveRepo.yearDoneCounts(year),
      ]);
      return buildWeeks(entryCounts, doneCounts, year);
    },
  });
}

export function useArchiveSearch(year: number, q: string) {
  return useQuery({
    queryKey: ['archive', 'search', year, q],
    queryFn: () => archiveRepo.searchDates(year, q),
    enabled: q.trim().length > 0,
  });
}

export function useDeleteArchiveRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (range: ArchiveRange) => archiveRepo.deleteRange(range),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive'] });
      qc.invalidateQueries({ queryKey: ['logEntries'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['dayStats'] });
    },
  });
}
