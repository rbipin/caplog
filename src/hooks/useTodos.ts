import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todosRepo } from '../data/todosRepo';
import { queryKeys } from './queryKeys';
import type { TodoItem } from '../types.js';

export function useTodos(cutoffDays?: number) {
  return useQuery({
    queryKey: queryKeys.todosList(cutoffDays),
    queryFn: () => todosRepo.list(cutoffDays),
  });
}

export function useCompletedTodos() {
  return useQuery({
    queryKey: queryKeys.completedTodos(),
    queryFn: () => todosRepo.listCompleted(),
  });
}

/**
 * Invalidates todos plus everything a todo change can affect: the chat feed
 * (created/completed todos appear there) and the sidebar counts.
 */
function useInvalidateTodos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.todos });
    qc.invalidateQueries({ queryKey: queryKeys.logEntries });
    qc.invalidateQueries({ queryKey: ['dayStats'] });
  };
}

export function useAddTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (input: { text: string; isImportant?: boolean; deadline?: string | null }) =>
      todosRepo.add(input.text, input.isImportant ?? false, input.deadline ?? null),
    onSuccess: invalidate,
  });
}

export function useCompleteTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (id: number) => todosRepo.completeTodo(id),
    onSuccess: invalidate,
  });
}

export function useCompleteTodoByText() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (text: string) => todosRepo.completeByText(text),
    onSuccess: invalidate,
  });
}

export function useReopenTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (id: number) => todosRepo.reopen(id),
    onSuccess: invalidate,
  });
}

export function useSetTodoImportant() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (input: { id: number; value: boolean }) =>
      todosRepo.setImportant(input.id, input.value),
    onSuccess: invalidate,
  });
}

export function useSetTodoDeadline() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (input: { id: number; deadline: string | null }) =>
      todosRepo.setDeadline(input.id, input.deadline),
    onSuccess: invalidate,
  });
}

export function useUpdateTodoText() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (input: { id: number; text: string }) =>
      todosRepo.updateText(input.id, input.text),
    onSuccess: invalidate,
  });
}

export function useDeleteTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (id: number) => todosRepo.remove(id),
    onSuccess: invalidate,
  });
}

export type { TodoItem };
