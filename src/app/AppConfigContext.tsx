import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { settingsRepo } from '../data/settingsRepo';
import { getAdapter } from '../llm/factory.js';
import { getToday } from '../utils.js';
import type { LLMAdapter } from '../llm/adapter.js';

export interface AppConfig {
  /** Number of days shown in the chat feed / sidebar window. */
  chatDays: number;
  /** Persist a new chat-day window and invalidate day-scoped queries. */
  setChatDays: (days: number) => Promise<void>;
  /** Current LLM adapter, or null when AI is not configured. */
  adapter: LLMAdapter | null;
  /** Re-read settings and rebuild the adapter (after a settings save). */
  refreshAdapter: () => Promise<void>;
  /** Local `YYYY-MM-DD` today, updated by the 60s rollover interval. */
  currentDate: string;
}

const AppConfigContext = createContext<AppConfig | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [chatDays, setChatDaysState] = useState(3);
  const [adapter, setAdapter] = useState<LLMAdapter | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(() => getToday());

  useEffect(() => {
    void (async () => {
      try {
        setChatDaysState(await settingsRepo.getChatDays());
        setAdapter(await getAdapter());
      } catch (err) {
        console.error('AppConfig init failed:', err);
      }
    })();
  }, []);

  // Date rollover: every minute, if the local day changed, refresh the feed.
  useEffect(() => {
    const id = setInterval(() => {
      const today = getToday();
      setCurrentDate((prev) => {
        if (prev === today) return prev;
        qc.invalidateQueries({ queryKey: ['logEntries'] });
        qc.invalidateQueries({ queryKey: ['todos'] });
        qc.invalidateQueries({ queryKey: ['dayStats'] });
        return today;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [qc]);

  const refreshAdapter = useCallback(async () => {
    setAdapter(await getAdapter());
  }, []);

  const setChatDays = useCallback(
    async (days: number) => {
      await settingsRepo.setChatDays(days);
      setChatDaysState(await settingsRepo.getChatDays());
      qc.invalidateQueries({ queryKey: ['logEntries'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['dayStats'] });
    },
    [qc]
  );

  const value = useMemo<AppConfig>(
    () => ({ chatDays, setChatDays, adapter, refreshAdapter, currentDate }),
    [chatDays, setChatDays, adapter, refreshAdapter, currentDate]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider');
  return ctx;
}
