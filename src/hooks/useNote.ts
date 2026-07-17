import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesRepo } from '../data/notesRepo';
import { queryKeys } from './queryKeys';

export function useNote() {
  return useQuery({
    queryKey: queryKeys.note,
    queryFn: () => notesRepo.getNote(),
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => notesRepo.saveNote(content),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.note }),
  });
}
