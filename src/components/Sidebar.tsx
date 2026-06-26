import { useState } from 'react';
import { useAppConfig } from '../app/AppConfigContext';
import { useDayStats } from '../hooks/useDayStats';
import { parseLocalDate } from '../utils.js';
import { Markdown } from './Markdown';
import type { DayStats } from '../types.js';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export interface SidebarProps {
  onDaySelect: (date: string) => void;
  onOpenArchive: () => void;
}

export function Sidebar({ onDaySelect, onOpenArchive }: SidebarProps) {
  const { chatDays } = useAppConfig();
  const { data: stats = [] } = useDayStats(chatDays);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-section-title">{monthLabel}</div>
        <button className="btn-ghost sidebar-archive-btn" onClick={onOpenArchive}>
          ⊞ Archive
        </button>
      </div>
      <div id="dayList">
        {stats.map((s, i) => {
          const active = activeDate ? activeDate === s.date : i === 0;
          return (
            <DayEntry
              key={s.date}
              stats={s}
              active={active}
              onClick={() => {
                setActiveDate(s.date);
                onDaySelect(s.date);
              }}
            />
          );
        })}
      </div>
    </aside>
  );
}

function DayEntry({ stats, active, onClick }: { stats: DayStats; active: boolean; onClick: () => void }) {
  const d = parseLocalDate(stats.date);
  return (
    <div className={`day-entry${active ? ' active' : ''}`} onClick={onClick}>
      <div className="day-entry-date">
        <div className="day-entry-dow">{DOW[d.getDay()]}</div>
        <div className="day-entry-num">{d.getDate()}</div>
      </div>
      <div>
        <div className="day-entry-preview">
          <Markdown inline>{stats.preview ?? ''}</Markdown>
        </div>
        <div className="day-entry-meta">
          {stats.log_count > 0 && <span className="tag tag-log">{stats.log_count} entries</span>}
          {stats.todo_done_count > 0 && (
            <span className="tag tag-todo">{stats.todo_done_count} done</span>
          )}
        </div>
      </div>
    </div>
  );
}
