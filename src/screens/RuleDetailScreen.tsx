import { useMemo, useState } from "react";
import type { BreakRecord, RuleRecord } from "@/domain/types";
import { setRuleArchived } from "@/db/repository";
import { useI18n } from "@/i18n/I18nProvider";
import {
  formatDayTitle,
  formatTime,
  localDateKeyFromIso,
} from "@/lib/dates";
import { breaksForRule, breakDateKey } from "@/domain/insights";
import { CategoryBadge, CategoryMark } from "@/components/CategoryMark";
import { ConfirmDialog } from "@/components/Sheet";
import { EmptyState } from "@/components/EmptyState";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useToast } from "@/components/Toast";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  EditIcon,
  RestoreIcon,
} from "@/components/Icons";

interface RuleDetailScreenProps {
  rule: RuleRecord;
  breaks: BreakRecord[];
  onBack: () => void;
  onEditRule: (rule: RuleRecord) => void;
  onLogSlip: (rule: RuleRecord) => void;
  onEditBreak: (rule: RuleRecord, record: BreakRecord) => void;
}

interface DayGroup {
  dateKey: string;
  records: BreakRecord[];
}

export function RuleDetailScreen({
  rule,
  breaks,
  onBack,
  onEditRule,
  onLogSlip,
  onEditBreak,
}: RuleDetailScreenProps) {
  const { locale, copy } = useI18n();
  const { showToast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const ordered = useMemo(() => breaksForRule(breaks, rule.id), [breaks, rule.id]);

  const countsByDay = useMemo(() => {
    const result = new Map<string, number>();
    for (const record of ordered) {
      const key = breakDateKey(record);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  }, [ordered]);

  const grouped = useMemo<DayGroup[]>(() => {
    const visible = selectedDateKey
      ? ordered.filter((record) => breakDateKey(record) === selectedDateKey)
      : ordered;
    const groups = new Map<string, BreakRecord[]>();
    for (const record of visible) {
      const key = breakDateKey(record);
      const list = groups.get(key) ?? [];
      list.push(record);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dateKey, records]) => ({ dateKey, records }));
  }, [ordered, selectedDateKey]);

  const addedDate = formatDayTitle(
    localDateKeyFromIso(rule.createdAt),
    locale,
    true,
  );

  function changeMonth(next: { year: number; month: number }) {
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(null);
  }

  async function archiveRule() {
    if (archiving) return;
    setArchiving(true);
    try {
      await setRuleArchived(rule.id, rule.rev, true);
      setArchiveConfirmOpen(false);
      showToast(copy.rule.archiveDone);
    } catch {
      showToast(copy.errors.archiveFailed, "error");
    } finally {
      setArchiving(false);
    }
  }

  async function restoreRule() {
    if (archiving) return;
    setArchiving(true);
    try {
      await setRuleArchived(rule.id, rule.rev, false);
      showToast(copy.rule.restoreDone);
    } catch {
      showToast(copy.errors.archiveFailed, "error");
    } finally {
      setArchiving(false);
    }
  }

  function renderMarks(dateKey: string) {
    const count = countsByDay.get(dateKey) ?? 0;
    const shown = Math.min(count, 3);
    return (
      <>
        {Array.from({ length: shown }, (_, index) => (
          <CategoryMark
            key={index}
            category={rule.category}
            size={6}
            className="calendar-mark"
          />
        ))}
        {count > 3 && <span className="calendar-more">+{count - 3}</span>}
      </>
    );
  }

  return (
    <>
      <div className="screen-scroll rule-detail-screen">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon size={18} />
          <span>{copy.rule.backToRules}</span>
        </button>

        <header className="rule-header" data-category={rule.category}>
          <div className="rule-header-badges">
            <CategoryBadge category={rule.category} />
            {rule.archived === 1 && (
              <span className="status-badge">{copy.rule.archivedBadge}</span>
            )}
          </div>
          <h2 className="rule-detail-title">{rule.title}</h2>
          {rule.description && (
            <p className="rule-detail-description">{rule.description}</p>
          )}
          <p className="rule-detail-meta">
            <span>{copy.rule.firstRecorded(addedDate)}</span>
            <span className="summary-divider" aria-hidden="true" />
            <span>{copy.common.slipsCount(ordered.length)}</span>
          </p>
        </header>

        {rule.archived === 1 && (
          <section className="archived-notice">
            <p>{copy.rule.archivedNote}</p>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => void restoreRule()}
              disabled={archiving}
            >
              <RestoreIcon size={16} />
              {copy.rule.restore}
            </button>
          </section>
        )}

        {rule.archived === 0 && (
          <div className="rule-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => onLogSlip(rule)}
            >
              {copy.rule.logSlip}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onEditRule(rule)}
            >
              <EditIcon size={17} />
              {copy.common.edit}
            </button>
          </div>
        )}

        <section className="section-block calendar-section">
          <div className="section-heading-row">
            <h3 className="section-title">{copy.rule.calendarTitle}</h3>
            {selectedDateKey && (
              <button
                type="button"
                className="text-button"
                onClick={() => setSelectedDateKey(null)}
              >
                {copy.rule.showAllDays}
              </button>
            )}
          </div>
          <div className="calendar-surface" data-category={rule.category}>
            <MonthCalendar
              year={year}
              month={month}
              onMonthChange={changeMonth}
              getCount={(dateKey) => countsByDay.get(dateKey) ?? 0}
              renderMarks={renderMarks}
              onSelectDate={(dateKey) =>
                setSelectedDateKey((current) =>
                  current === dateKey ? null : dateKey,
                )
              }
              selectedDateKey={selectedDateKey}
            />
          </div>
        </section>

        <section className="section-block history-section">
          <div className="section-heading-row">
            <h3 className="section-title">
              {selectedDateKey
                ? copy.rule.selectedDay(
                    formatDayTitle(selectedDateKey, locale, true),
                  )
                : copy.rule.historyTitle}
            </h3>
            {selectedDateKey && (
              <span className="section-count">
                {copy.common.slipsCount(ordered.filter((record) => breakDateKey(record) === selectedDateKey).length)}
              </span>
            )}
          </div>

          {ordered.length === 0 ? (
            <EmptyState
              title={copy.rule.emptyBreaksTitle}
              body={copy.rule.emptyBreaksBody}
            />
          ) : grouped.length === 0 ? (
            <p className="quiet-note">{copy.rule.noSlipsOnDay}</p>
          ) : (
            <div className="history-groups">
              {grouped.map((group) => (
                <section key={group.dateKey} className="history-day">
                  <h4 className="history-date">
                    {formatDayTitle(group.dateKey, locale)}
                  </h4>
                  <ul className="slip-list">
                    {group.records.map((record) => (
                      <li
                        key={record.id}
                        className="slip-entry"
                        data-category={rule.category}
                      >
                        <div className="slip-meta">
                          <time
                            className="slip-time"
                            dateTime={record.occurredAt}
                          >
                            {formatTime(record.occurredAt, locale)}
                          </time>
                          {record.source === "assistant" && (
                            <span className="source-tag">AI</span>
                          )}
                        </div>
                        <div className="slip-content">
                          <p className="slip-situation">{record.situation}</p>
                          {record.reflection && (
                            <div className="slip-reflection">
                              <span className="slip-reflection-label">
                                {copy.breakForm.reflectionLabel}
                              </span>
                              <p>{record.reflection}</p>
                            </div>
                          )}
                          <button
                            type="button"
                            className="slip-edit"
                            onClick={() => onEditBreak(rule, record)}
                            aria-label={copy.breakForm.editSlip}
                            title={copy.breakForm.editSlip}
                          >
                            {copy.common.edit}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="rule-danger-zone">
          {rule.archived === 0 ? (
            <button
              type="button"
              className="button button--quiet danger-text"
              onClick={() => setArchiveConfirmOpen(true)}
            >
              <ArchiveIcon size={17} />
              {copy.rule.archive}
            </button>
          ) : (
            <button
              type="button"
              className="button button--quiet"
              onClick={() => void restoreRule()}
              disabled={archiving}
            >
              <RestoreIcon size={17} />
              {copy.rule.restore}
            </button>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => void archiveRule()}
        title={copy.rule.archiveConfirmTitle}
        body={copy.rule.archiveConfirmBody}
        confirmLabel={copy.rule.archive}
        cancelLabel={copy.common.cancel}
        busy={archiving}
      />
    </>
  );
}
