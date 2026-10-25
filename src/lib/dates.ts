import type { Locale } from "@/domain/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function localDateKeyFromIso(iso: string): string {
  return localDateKey(new Date(iso));
}

export function dateFromKey(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid local date key");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid local date key");
  }
  return date;
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addLocalMonths(year: number, monthIndex: number, delta: number): {
  year: number;
  month: number;
} {
  const date = new Date(year, monthIndex + delta, 1, 12, 0, 0, 0);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function localMonthParts(date: Date = new Date()): {
  year: number;
  month: number;
} {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export interface CalendarCell {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Six stable rows, Monday first. Adjacent-month days are included so the grid
 * does not change height between months.
 */
export function monthCalendarCells(
  year: number,
  monthIndex: number,
  todayKey = localDateKey(),
): CalendarCell[] {
  const first = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = addLocalDays(first, -mondayOffset);
  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = addLocalDays(start, index);
    const dateKey = localDateKey(date);
    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
      isToday: dateKey === todayKey,
    });
  }
  return cells;
}

export function weekdayLabels(locale: Locale): string[] {
  const monday = new Date(2024, 0, 1, 12, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addLocalDays(monday, index)),
  );
}

export function formatMonthTitle(
  year: number,
  monthIndex: number,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(new Date(year, monthIndex, 1, 12, 0, 0, 0));
}

export function formatDayTitle(
  dateKey: string,
  locale: Locale,
  includeYear = false,
): string {
  const date = dateFromKey(dateKey);
  return new Intl.DateTimeFormat(locale, {
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(
  iso: string,
  locale: Locale,
  includeYear = false,
): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale, {
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function relativeDayLabel(
  dateKey: string,
  locale: Locale,
  now = new Date(),
): string | null {
  const todayKey = localDateKey(now);
  const difference = Math.round(
    (dateFromKey(dateKey).getTime() - dateFromKey(todayKey).getTime()) / DAY_MS,
  );
  if (Math.abs(difference) > 30) return null;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    difference,
    "day",
  );
}

export function relativeTimestampLabel(
  iso: string,
  locale: Locale,
  now = new Date(),
): string {
  const dateKey = localDateKeyFromIso(iso);
  return (
    relativeDayLabel(dateKey, locale, now) ??
    formatDateTime(iso, locale, new Date(iso).getFullYear() !== now.getFullYear())
  );
}

export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return `${localDateKey(date)}T${pad2(date.getHours())}:${pad2(
    date.getMinutes(),
  )}`;
}

export function fromLocalDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function nowForDateTimeInput(now = new Date()): string {
  return toLocalDateTimeInput(now.toISOString());
}

export function isAfterNow(iso: string, toleranceMs = 0, now = new Date()): boolean {
  return new Date(iso).getTime() > now.getTime() + toleranceMs;
}

export function isFutureOrInvalidBreak(
  iso: string,
  toleranceMs: number,
  now = new Date(),
): boolean {
  const value = Date.parse(iso);
  return Number.isNaN(value) || value > now.getTime() + toleranceMs;
}

export function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function isSameMonth(
  dateKey: string,
  year: number,
  monthIndex: number,
): boolean {
  const prefix = `${year}-${pad2(monthIndex + 1)}-`;
  return dateKey.startsWith(prefix);
}

export function isoInLocalDateKey(
  iso: string,
  dateKey: string,
): boolean {
  return localDateKeyFromIso(iso) === dateKey;
}

export function timestampValue(iso: string): number {
  return Date.parse(iso);
}

export function sortByOccurredDesc<T extends { occurredAt: string; id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      timestampValue(right.occurredAt) - timestampValue(left.occurredAt) ||
      left.id.localeCompare(right.id),
  );
}
