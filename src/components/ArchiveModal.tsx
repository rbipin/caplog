import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useArchiveYear, useArchiveSearch, useDeleteArchiveRange } from '../hooks/useArchive';
import { archiveRepo, type ArchiveRange } from '../data/archiveRepo';
import { parseLocalDate, getToday } from '../utils.js';
import type { DayData, WeekData } from '../archiveUtils.js';
import { ArchiveConfirmModal, type ArchiveConfirmState } from './ArchiveConfirmModal';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export interface ArchiveModalProps {
  onDaySelect: (date: string) => void;
  onClose: () => void;
}

export function ArchiveModal({ onDaySelect, onClose }: ArchiveModalProps) {
  const maxYear = new Date().getFullYear();
  const [year, setYear] = useState(maxYear);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<ArchiveConfirmState | null>(null);
  const today = getToday();

  const { data: weeks } = useArchiveYear(year);
  const { data: matchingDates } = useArchiveSearch(year, query);
  const deleteRange = useDeleteArchiveRange();

  // Debounce search input.
  useEffect(() => {
    const id = setTimeout(() => setQuery(searchText.trim()), 200);
    return () => clearTimeout(id);
  }, [searchText]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (confirm) setConfirm(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, confirm]);

  const sortedWeeks = useMemo(() => {
    if (!weeks) return [];
    return Array.from(weeks.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [weeks]);

  async function requestClean(range: ArchiveRange, label: string) {
    const { entries, todos } = await archiveRepo.countRange(range);
    setConfirm({
      title: `Delete ${label}?`,
      body: `${entries} log entries and ${todos} todos will be permanently deleted. This cannot be undone.`,
      onConfirm: () => deleteRange.mutate(range),
    });
  }

  const searchActive = query.length > 0;

  // Build rows with month dividers interleaved.
  const rows: ReactElement[] = [];
  let lastMonth = '';
  for (const week of sortedWeeks) {
    const yearStr = String(year);
    const firstInYear = week.days
      .filter((d) => d.date.startsWith(yearStr))
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const monthKey = firstInYear ? firstInYear.date.substring(0, 7) : week.weekStart.substring(0, 7);

    if (monthKey !== lastMonth) {
      lastMonth = monthKey;
      const [yr, mo] = monthKey.split('-');
      const label = parseLocalDate(`${yr}-${mo}-01`).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      rows.push(
        <div className="archive-month-divider" key={`divider-${monthKey}`}>
          <div className="archive-month-line" />
          <div className="archive-month-label">{label}</div>
          <button
            className="archive-clean-btn"
            title={`Delete ${label}`}
            onClick={() => void requestClean({ type: 'month', yearMonth: monthKey }, label)}
          >
            🗑
          </button>
          <div className="archive-month-line" />
        </div>
      );
    }

    rows.push(
      <WeekCard
        key={`week-${week.weekStart}`}
        week={week}
        today={today}
        searchActive={searchActive}
        matchingDates={matchingDates ?? null}
        onDaySelect={onDaySelect}
        onCleanWeek={(label, range) => void requestClean(range, label)}
        onCleanDay={(label, range) => void requestClean(range, label)}
      />
    );
  }

  return (
    <div
      className="archive-overlay visible"
      id="archiveModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="archive-header">
        <span className="archive-title">Archive</span>
        <input
          className="archive-search"
          id="archiveSearchInput"
          placeholder="Search entries..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="archive-year-nav">
          <button className="btn-ghost" id="archiveYearPrev" onClick={() => setYear((y) => y - 1)}>
            ◀
          </button>
          <span className="archive-year-label" id="archiveYearLabel">
            {year}
          </span>
          <button
            className="btn-ghost"
            id="archiveYearNext"
            disabled={year >= maxYear}
            onClick={() => setYear((y) => Math.min(maxYear, y + 1))}
          >
            ▶
          </button>
        </div>
        <button className="modal-close" id="archiveCloseBtn" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="archive-body" id="archiveBody">
        {rows}
      </div>
      <ArchiveConfirmModal state={confirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

interface WeekCardProps {
  week: WeekData;
  today: string;
  searchActive: boolean;
  matchingDates: Set<string> | null;
  onDaySelect: (date: string) => void;
  onCleanWeek: (label: string, range: ArchiveRange) => void;
  onCleanDay: (label: string, range: ArchiveRange) => void;
}

function WeekCard({
  week,
  today,
  searchActive,
  matchingDates,
  onDaySelect,
  onCleanWeek,
  onCleanDay,
}: WeekCardProps) {
  const d = parseLocalDate(week.weekStart);
  const weekLabel = `Week of ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;

  const cardHasMatch = searchActive
    ? week.days.some((day) => matchingDates?.has(day.date))
    : true;

  function cleanWeek() {
    const start = parseLocalDate(week.weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(
      end.getDate()
    ).padStart(2, '0')}`;
    onCleanWeek(weekLabel, { type: 'week', start: week.weekStart, end: endDate });
  }

  return (
    <div
      className={`archive-week-card${searchActive && !cardHasMatch ? ' search-hidden' : ''}`}
      data-week-start={week.weekStart}
    >
      <div className="archive-week-header">
        <span className="archive-week-label">{weekLabel}</span>
        <div className="archive-week-stats">
          {week.totalEntries > 0 && <span className="tag tag-log">{week.totalEntries} entries</span>}
          {week.totalDone > 0 && <span className="tag tag-todo">{week.totalDone} done</span>}
          {week.totalEntries > 0 && (
            <button className="archive-clean-btn" title="Delete this week" onClick={cleanWeek}>
              🗑
            </button>
          )}
        </div>
      </div>
      <div className="archive-week-days">
        {week.days.map((day) => (
          <DayTile
            key={day.date}
            day={day}
            today={today}
            searchActive={searchActive}
            isMatch={matchingDates?.has(day.date) ?? false}
            onDaySelect={onDaySelect}
            onCleanDay={onCleanDay}
          />
        ))}
      </div>
    </div>
  );
}

interface DayTileProps {
  day: DayData;
  today: string;
  searchActive: boolean;
  isMatch: boolean;
  onDaySelect: (date: string) => void;
  onCleanDay: (label: string, range: ArchiveRange) => void;
}

function DayTile({ day, today, searchActive, isMatch, onDaySelect, onCleanDay }: DayTileProps) {
  const d = parseLocalDate(day.date);
  const isEmpty = day.entryCount === 0 && day.doneCount === 0;
  const isToday = day.date === today;
  const countLabel = isEmpty
    ? '—'
    : day.entryCount > 0
      ? `${day.entryCount} entries`
      : `${day.doneCount} done`;

  const classes = ['archive-day-tile'];
  if (isEmpty) classes.push('empty');
  if (isToday) classes.push('today');
  if (searchActive) classes.push(isMatch ? 'search-match' : 'search-no-match');

  function cleanDay(e: React.MouseEvent) {
    e.stopPropagation();
    const label = parseLocalDate(day.date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    onCleanDay(label, { type: 'day', date: day.date });
  }

  return (
    <div
      className={classes.join(' ')}
      data-date={day.date}
      onClick={isEmpty ? undefined : () => onDaySelect(day.date)}
    >
      <div className="archive-day-dow">{DOW[d.getDay()]}</div>
      <div className="archive-day-num">{d.getDate()}</div>
      <div className="archive-day-count">{countLabel}</div>
      {!isEmpty && (
        <button className="archive-clean-btn" title={`Delete ${day.date}`} onClick={cleanDay}>
          🗑
        </button>
      )}
    </div>
  );
}
