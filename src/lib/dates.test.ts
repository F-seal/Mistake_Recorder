import { describe, expect, it } from "vitest";
import {
  fromLocalDateTimeInput,
  isFutureOrInvalidBreak,
  localDateKey,
  monthCalendarCells,
  nowForDateTimeInput,
  relativeDayLabel,
  toLocalDateTimeInput,
  weekdayLabels,
} from "./dates";

describe("local dates", () => {
  it("keeps local date keys stable across ISO conversion", () => {
    const local = new Date(2026, 9, 25, 23, 30);
    const iso = local.toISOString();
    expect(localDateKey(local)).toBe("2026-10-25");
    expect(toLocalDateTimeInput(iso)).toBe("2026-10-25T23:30");
    const roundTrip = fromLocalDateTimeInput("2026-10-25T23:30");
    expect(roundTrip).toBe(iso);
  });

  it("builds a six-week Monday-first grid and marks the month", () => {
    const cells = monthCalendarCells(2026, 9, "2026-10-25");
    expect(cells).toHaveLength(42);
    const first = cells[0];
    expect(first?.dateKey).toBe("2026-09-28");
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(cells.find((cell) => cell.isToday)?.dateKey).toBe("2026-10-25");
  });

  it("uses locale-aware weekdays and relative day labels", () => {
    expect(weekdayLabels("zh-CN")).toHaveLength(7);
    expect(weekdayLabels("en")).toHaveLength(7);
    expect(relativeDayLabel("2026-10-25", "en", new Date(2026, 9, 25, 8))).toBe(
      "today",
    );
    expect(relativeDayLabel("2026-10-23", "en", new Date(2026, 9, 25, 8))).toBe(
      "2 days ago",
    );
    expect(
      relativeDayLabel("2026-08-01", "en", new Date(2026, 9, 25, 8)),
    ).toBeNull();
  });

  it("rejects future or unreadable slip times", () => {
    const now = new Date(2026, 9, 25, 12, 0);
    expect(isFutureOrInvalidBreak("nope", 0, now)).toBe(true);
    expect(isFutureOrInvalidBreak(now.toISOString(), 0, now)).toBe(false);
    expect(
      isFutureOrInvalidBreak(
        new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        5 * 60 * 1000,
        now,
      ),
    ).toBe(true);
    expect(nowForDateTimeInput(now)).toBe("2026-10-25T12:00");
  });
});
