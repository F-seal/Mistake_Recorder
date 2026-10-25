import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  addLocalMonths,
  formatDayTitle,
  formatMonthTitle,
  localDateKey,
  monthCalendarCells,
  weekdayLabels,
} from "@/lib/dates";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

export interface MonthCalendarProps {
  year: number;
  month: number;
  onMonthChange: (next: { year: number; month: number }) => void;
  getCount: (dateKey: string) => number;
  renderMarks?: (dateKey: string) => ReactNode;
  onSelectDate?: (dateKey: string) => void;
  selectedDateKey?: string | null;
}

export function MonthCalendar({
  year,
  month,
  onMonthChange,
  getCount,
  renderMarks,
  onSelectDate,
  selectedDateKey,
}: MonthCalendarProps) {
  const { locale, copy } = useI18n();
  const todayKey = localDateKey();
  const cells = monthCalendarCells(year, month, todayKey);
  const weekdays = weekdayLabels(locale);
  const previous = addLocalMonths(year, month, -1);
  const next = addLocalMonths(year, month, 1);

  return (
    <div className="month-calendar">
      <div className="calendar-header">
        <button
          type="button"
          className="icon-button icon-button--small"
          onClick={() => onMonthChange(previous)}
          aria-label={copy.calendar.previousMonth}
        >
          <ChevronLeftIcon size={18} />
        </button>
        <h3 className="calendar-title" aria-live="polite">
          {formatMonthTitle(year, month, locale)}
        </h3>
        <button
          type="button"
          className="icon-button icon-button--small"
          onClick={() => onMonthChange(next)}
          aria-label={copy.calendar.nextMonth}
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday, index) => (
          <span key={`${weekday}-${index}`}>{weekday}</span>
        ))}
      </div>

      <div className="calendar-grid" role="group" aria-label={formatMonthTitle(year, month, locale)}>
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return (
              <div key={cell.dateKey} className="calendar-cell calendar-cell--outside" aria-hidden="true">
                <span className="calendar-day-number">{cell.day}</span>
              </div>
            );
          }

          const count = getCount(cell.dateKey);
          const canSelect = Boolean(onSelectDate) && count > 0;
          const selected = selectedDateKey === cell.dateKey;
          const label =
            count > 0
              ? copy.calendar.dayAria(
                  formatDayTitle(cell.dateKey, locale, true),
                  count,
                )
              : copy.calendar.dayEmptyAria(
                  formatDayTitle(cell.dateKey, locale, true),
                );

          const content = (
            <>
              <span className="calendar-day-number">{cell.day}</span>
              {count > 0 && renderMarks && (
                <span className="calendar-marks" aria-hidden="true">
                  {renderMarks(cell.dateKey)}
                </span>
              )}
              {cell.isToday && <span className="calendar-today-dot" aria-hidden="true" />}
            </>
          );

          if (!canSelect) {
            return (
              <div
                key={cell.dateKey}
                className={`calendar-cell${cell.isToday ? " calendar-cell--today" : ""}${
                  selected ? " calendar-cell--selected" : ""
                }`}
                aria-label={label}
                role="img"
              >
                {content}
              </div>
            );
          }

          return (
            <button
              key={cell.dateKey}
              type="button"
              className={`calendar-cell calendar-cell--interactive${
                cell.isToday ? " calendar-cell--today" : ""
              }${selected ? " calendar-cell--selected" : ""}`}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onSelectDate?.(cell.dateKey)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
