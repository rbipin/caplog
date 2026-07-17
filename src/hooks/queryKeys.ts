/** Shared TanStack Query key contract (see design doc). */
export const queryKeys = {
  logEntries: ['logEntries'] as const,
  recentLogEntries: (days: number) => ['logEntries', 'recent', days] as const,
  allLogEntries: () => ['logEntries', 'all'] as const,
  logEntriesByDate: (date: string) => ['logEntries', 'byDate', date] as const,
  todos: ['todos'] as const,
  todosList: (cutoffDays?: number) => ['todos', 'list', cutoffDays ?? null] as const,
  completedTodos: () => ['todos', 'completed'] as const,
  todoById: (id: number) => ['todos', 'byId', id] as const,
  dayStats: (days: number) => ['dayStats', days] as const,
  settings: ['settings'] as const,
  note: ['note'] as const,
};
