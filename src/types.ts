export interface TodoItem {
  id: number;
  text: string;
  is_important: 0 | 1;
  is_completed: 0 | 1;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
}

export type MessageType = 'log' | 'todo-created' | 'todo-completed' | 'system';

export interface Message {
  time: string;
  type: MessageType;
  typeLabel: string;
  content: string;
  rawInput?: string;
  entryId?: number;   // only set for 'log' type messages loaded from DB
}

export interface LogEntry {
  id: number;
  date: string;
  raw_text: string;
  formatted_text: string;
  created_at: string;
}

export interface DayStats {
  date: string;
  log_count: number;
  todo_done_count: number;
  preview: string | null;
}

export type FeedItem =
  | { created_at: string; kind: 'log'; entry: LogEntry }
  | { created_at: string; kind: 'todo'; todo: TodoItem }
  | { created_at: string; kind: 'todo-completed'; todo: TodoItem };
