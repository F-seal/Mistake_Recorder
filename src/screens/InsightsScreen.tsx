import { useMemo, useState } from "react";
import type { BreakRecord, RuleRecord } from "@/domain/types";
import {
  breakDateKey,
  breaksForDay,
  buildInsights,
  categoryCountsForBreaks,
} from "@/domain/insights";
import { useI18n } from "@/i18n/I18nProvider";
import {
  formatDayTitle,
  formatNumber,
  formatTime,
} from "@/lib/dates";
import { CategoryBadge, CategoryMark } from "@/components/CategoryMark";
import { MonthCalendar } from "@/components/MonthCalendar";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Sheet } from "@/components/Sheet";

function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-`;
}

export function InsightsScreen({
  rules,
  breaks,
  onOpenRule,
}: {
  rules: RuleRecord[];
  breaks: BreakRecord[];
  onOpenRule: (ruleId: string) => void;
}) {
  const { locale, copy } = useI18n();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [range, setRange] = useState<"recent" | "all">("recent");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const ruleById = useMemo(
    () => new Map(rules.map((rule) => [rule.id, rule])),
    [rules],
  );
  const insights = useMemo(() => buildInsights(rules, breaks, now), [rules, breaks]);

  const prefix = monthPrefix(year, month);
  const visibleBreaks = useMemo(
    () =>
      breaks
        .filter((record) => breakDateKey(record).startsWith(prefix))
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)),
    [breaks, prefix],
  );

  const categoriesByDay = useMemo(() => {
    const map = new Map<string, RuleRecord["category"][]>();
    for (const record of visibleBreaks) {
      const rule = ruleById.get(record.ruleId);
      if (!rule) continue;
      const key = breakDateKey(record);
      const list = map.get(key) ?? [];
      list.push(rule.category);
      map.set(key, list);
    }
    return map;
  }, [visibleBreaks, ruleById]);

  const monthCategoryCounts = useMemo(
    () => categoryCountsForBreaks(visibleBreaks, rules),
    [visibleBreaks, rules],
  );
  const monthTotal = visibleBreaks.length;

  const rangeRules = range === "all" ? insights.rulesAll : insights.rulesRecent;
  const rangeCategories =
    range === "all" ? insights.categoriesAll : insights.categoriesRecent;
  const topRule = rangeRules[0] ?? null;
  const topCategory =
    rangeCategories.find((entry) => entry.count > 0) ?? null;
  const ranking = rangeRules.slice(0, 5);
  const rankingMax = ranking[0]?.count ?? 1;

  const dayBreaks = useMemo(
    () =>
      selectedDayKey
        ? breaksForDay(breaks, selectedDayKey)
            .map((record) => ({ record, rule: ruleById.get(record.ruleId) }))
            .filter(
              (
                entry,
              ): entry is { record: BreakRecord; rule: RuleRecord } =>
                Boolean(entry.rule),
            )
        : [],
    [breaks, ruleById, selectedDayKey],
  );

  function changeMonth(next: { year: number; month: number }) {
    setYear(next.year);
    setMonth(next.month);
    setSelectedDayKey(null);
  }

  function renderMarks(dateKey: string) {
    const categories = categoriesByDay.get(dateKey) ?? [];
    const shown = categories.slice(0, 3);
    return (
      <>
        {shown.map((category, index) => (
          <CategoryMark
            key={`${category}-${index}`}
            category={category}
            size={6}
            className="calendar-mark"
          />
        ))}
        {categories.length > 3 && (
          <span className="calendar-more">+{categories.length - 3}</span>
        )}
      </>
    );
  }

  return (
    <>
      <div className="screen-scroll insights-screen">
        <header className="page-heading">
          <h2 className="page-title">{copy.insights.title}</h2>
        </header>

        <section className="insight-overview" aria-labelledby="month-hero-label">
          <div className="hero-figure-block">
            <p id="month-hero-label" className="hero-label">
              {copy.insights.heroLabel}
            </p>
            <p className="hero-value">{formatNumber(insights.thisMonth, locale)}</p>
          </div>
          <dl className="overview-stats">
            <div>
              <dt>{copy.insights.last30}</dt>
              <dd>{formatNumber(insights.recent, locale)}</dd>
            </div>
            <div>
              <dt>{copy.insights.totalBreaks}</dt>
              <dd>{formatNumber(insights.total, locale)}</dd>
            </div>
          </dl>
        </section>

        <section className="section-block">
          <div className="section-heading-row">
            <h3 className="section-title">{copy.insights.calendarTitle}</h3>
            <span className="section-count">
              {copy.common.slipsCount(monthTotal)}
            </span>
          </div>
          <div className="calendar-surface">
            <MonthCalendar
              year={year}
              month={month}
              onMonthChange={changeMonth}
              getCount={(dateKey) => categoriesByDay.get(dateKey)?.length ?? 0}
              renderMarks={renderMarks}
              onSelectDate={setSelectedDayKey}
              selectedDateKey={selectedDayKey}
            />
          </div>
          <div className="calendar-legend-block">
            <h4 className="subsection-title">{copy.insights.legendTitle}</h4>
            <ul className="category-breakdown">
              {monthCategoryCounts.map(({ category, count }) => (
                <li key={category} className="category-breakdown-row">
                  <span className="category-breakdown-label">
                    <CategoryMark category={category} size={9} />
                    <span>{copy.categories[category]}</span>
                  </span>
                  <span className="category-breakdown-count">
                    {formatNumber(count, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section-block repeat-section">
          <div className="repeat-heading">
            <h3 className="section-title">{copy.insights.topTitle}</h3>
            <SegmentedControl
              options={[
                { id: "recent", label: copy.insights.recent },
                { id: "all", label: copy.insights.total },
              ]}
              value={range}
              onChange={setRange}
              ariaLabel={copy.insights.topTitle}
            />
          </div>
          <p className="range-hint">
            {range === "recent" ? copy.insights.recentHint : copy.insights.allTimeHint}
          </p>

          <div className="top-facts">
            <div className="top-fact">
              <p className="fact-label">{copy.insights.topRule}</p>
              {topRule ? (
                <>
                  <p className="fact-value">{topRule.rule.title}</p>
                  <p className="fact-meta">
                    <CategoryBadge category={topRule.rule.category} />
                    <span>{copy.common.times(topRule.count)}</span>
                  </p>
                </>
              ) : (
                <p className="fact-empty">{copy.insights.noTopRule}</p>
              )}
            </div>
            <div className="top-fact">
              <p className="fact-label">{copy.insights.topCategory}</p>
              {topCategory ? (
                <>
                  <p className="fact-value fact-value--category">
                    <CategoryMark category={topCategory.category} size={11} />
                    <span>{copy.categories[topCategory.category]}</span>
                  </p>
                  <p className="fact-meta">
                    <span>{copy.common.times(topCategory.count)}</span>
                  </p>
                </>
              ) : (
                <p className="fact-empty">{copy.insights.noTopCategory}</p>
              )}
            </div>
          </div>

          <div className="ranking-block">
            <h4 className="subsection-title">{copy.insights.rankingTitle}</h4>
            {ranking.length === 0 ? (
              <p className="quiet-note">{copy.insights.rankingEmpty}</p>
            ) : (
              <ol className="rank-list">
                {ranking.map(({ rule, count }) => (
                  <li key={rule.id}>
                    <button
                      type="button"
                      className="rank-row"
                      onClick={() => onOpenRule(rule.id)}
                    >
                      <CategoryMark category={rule.category} size={8} />
                      <span className="rank-body">
                        <span className="rank-heading">
                          <span className="rank-title">{rule.title}</span>
                          <span className="rank-count">
                            {copy.common.times(count)}
                          </span>
                        </span>
                        <span className="rank-track" aria-hidden="true">
                          <span
                            className="rank-fill"
                            style={{
                              width: `${Math.max(6, (count / rankingMax) * 100)}%`,
                              backgroundColor: `var(--cat-${rule.category})`,
                            }}
                          />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {insights.total === 0 && (
            <div className="no-data-note">
              <p className="no-data-title">{copy.insights.noDataTitle}</p>
              <p>{copy.insights.noDataBody}</p>
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={Boolean(selectedDayKey)}
        onClose={() => setSelectedDayKey(null)}
        title={
          selectedDayKey
            ? copy.insights.dayDetailTitle(
                formatDayTitle(selectedDayKey, locale, true),
              )
            : ""
        }
      >
        {dayBreaks.length === 0 ? (
          <p className="quiet-note">{copy.insights.dayDetailEmpty}</p>
        ) : (
          <ul className="day-slip-list">
            {dayBreaks.map(({ record, rule }) => (
              <li key={record.id} className="day-slip">
                <div className="day-slip-head">
                  <time dateTime={record.occurredAt}>
                    {formatTime(record.occurredAt, locale)}
                  </time>
                  <CategoryBadge category={rule.category} />
                </div>
                <button
                  type="button"
                  className="day-slip-rule"
                  onClick={() => {
                    setSelectedDayKey(null);
                    onOpenRule(rule.id);
                  }}
                >
                  {rule.title}
                </button>
                <p className="day-slip-situation">{record.situation}</p>
                {record.reflection && (
                  <p className="day-slip-reflection">{record.reflection}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
