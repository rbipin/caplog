export interface TodoItem {
  id: number;
  text: string;
  is_important: 0 | 1;
  is_completed: 0 | 1;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
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
