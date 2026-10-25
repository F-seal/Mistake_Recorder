import { useMemo, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/domain/constants";
import {
  breakDateKey,
  decorateRules,
  searchRules,
  sortRulesForList,
} from "@/domain/insights";
import type { BreakRecord, RuleRecord } from "@/domain/types";
import { setRuleArchived } from "@/db/repository";
import { useI18n } from "@/i18n/I18nProvider";
import { relativeTimestampLabel } from "@/lib/dates";
import { CategoryBadge, CategoryMark } from "@/components/CategoryMark";
import { EmptyState } from "@/components/EmptyState";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ArchiveIcon, RestoreIcon, SearchIcon } from "@/components/Icons";

interface RulebookScreenProps {
  rules: RuleRecord[];
  breaks: BreakRecord[];
  onOpenRule: (ruleId: string) => void;
  onNewRule: (category?: CategoryId) => void;
  onLogSlip: (rule: RuleRecord) => void;
}

export function RulebookScreen({
  rules,
  breaks,
  onOpenRule,
  onNewRule,
  onLogSlip,
}: RulebookScreenProps) {
  const { locale, copy } = useI18n();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.archived === 0),
    [rules],
  );
  const archivedRules = useMemo(
    () => rules.filter((rule) => rule.archived === 1),
    [rules],
  );

  const decorated = useMemo(() => {
    const searched = searchRules(activeRules, query);
    const filtered =
      category === "all"
        ? searched
        : searched.filter((rule) => rule.category === category);
    return sortRulesForList(decorateRules(filtered, breaks));
  }, [activeRules, breaks, query, category]);

  const monthCount = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0",
    )}-`;
    return breaks.filter((record) => breakDateKey(record).startsWith(prefix)).length;
  }, [breaks]);

  const hasActiveRules = activeRules.length > 0;
  const filteredEmpty = hasActiveRules && decorated.length === 0;
  const isFiltering = Boolean(query.trim()) || category !== "all";

  async function restoreRule(rule: RuleRecord) {
    if (restoringId) return;
    setRestoringId(rule.id);
    try {
      await setRuleArchived(rule.id, rule.rev, false);
      if (archivedRules.length <= 1) setArchivedOpen(false);
      showToast(copy.rule.restoreDone);
    } catch {
      showToast(copy.errors.archiveFailed, "error");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <div className="screen-scroll rulebook-screen">
        <header className="page-heading">
          <h2 className="page-title">{copy.rulebook.title}</h2>
          <p className="page-summary">
            <span>{copy.common.rulesCount(activeRules.length)}</span>
            <span className="summary-divider" aria-hidden="true" />
            <span>{copy.rulebook.monthlySlips(monthCount)}</span>
          </p>
        </header>

        {hasActiveRules && (
          <>
            <div className="search-field">
              <SearchIcon size={18} className="search-field-icon" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.rulebook.searchPlaceholder}
                aria-label={copy.rulebook.searchPlaceholder}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery("")}
                  aria-label={copy.rulebook.clearSearch}
                >
                  {copy.common.clear}
                </button>
              )}
            </div>

            <div
              className="filter-row"
              role="group"
              aria-label={copy.rulebook.filterLabel}
            >
              <button
                type="button"
                className={`filter-chip${category === "all" ? " filter-chip--active" : ""}`}
                aria-pressed={category === "all"}
                onClick={() => setCategory("all")}
              >
                {copy.common.all}
              </button>
              {CATEGORIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-chip${category === id ? " filter-chip--active" : ""}`}
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                >
                  <CategoryMark category={id} size={8} />
                  <span>{copy.categories[id]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {!hasActiveRules ? (
          <EmptyState
            title={copy.rulebook.noRulesTitle}
            body={copy.rulebook.noRulesBody}
            actionLabel={copy.rulebook.noRulesAction}
            onAction={() => onNewRule()}
          />
        ) : filteredEmpty ? (
          <EmptyState
            title={
              isFiltering
                ? category !== "all" && !query.trim()
                  ? copy.rulebook.noCategoryTitle
                  : copy.rulebook.noMatchesTitle
                : copy.rulebook.noMatchesTitle
            }
            body={
              isFiltering
                ? category !== "all" && !query.trim()
                  ? copy.rulebook.noCategoryBody
                  : copy.rulebook.noMatchesBody
                : copy.rulebook.noMatchesBody
            }
            actionLabel={copy.rulebook.newRule}
            onAction={() => onNewRule(category === "all" ? undefined : category)}
          />
        ) : (
          <ul className="rule-list">
            {decorated.map((rule) => {
              const relative = rule.lastBreakAt
                ? relativeTimestampLabel(rule.lastBreakAt, locale)
                : null;
              return (
                <li
                  key={rule.id}
                  className="rule-row"
                  data-category={rule.category}
                >
                  <button
                    type="button"
                    className="rule-open"
                    onClick={() => onOpenRule(rule.id)}
                  >
                    <span className="rule-copy">
                      <span className="rule-kicker">
                        <CategoryBadge category={rule.category} />
                        <span className="rule-count">
                          {copy.common.slipsCount(rule.breakCount)}
                        </span>
                      </span>
                      <span className="rule-title">{rule.title}</span>
                      {rule.description && (
                        <span className="rule-description">{rule.description}</span>
                      )}
                      <span className="rule-meta">
                        {relative ? (
                          copy.rulebook.lastSlip(relative)
                        ) : (
                          copy.rulebook.noBreaks
                        )}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rule-log-button"
                    onClick={() => onLogSlip(rule)}
                  >
                    {copy.rulebook.logSlip}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {archivedRules.length > 0 && (
          <button
            type="button"
            className="archived-link"
            onClick={() => setArchivedOpen(true)}
          >
            <ArchiveIcon size={17} />
            <span>{copy.rulebook.archivedCount(archivedRules.length)}</span>
          </button>
        )}
      </div>

      <Sheet
        open={archivedOpen}
        onClose={() => setArchivedOpen(false)}
        title={copy.rulebook.archivedCount(archivedRules.length)}
        subtitle={copy.settings.archivedNote}
      >
        {archivedRules.length === 0 ? (
          <p className="dialog-copy">{copy.settings.noArchived}</p>
        ) : (
          <ul className="archive-list">
            {archivedRules.map((rule) => (
              <li key={rule.id} className="archive-row" data-category={rule.category}>
                <button
                  type="button"
                  className="archive-open"
                  onClick={() => {
                    setArchivedOpen(false);
                    onOpenRule(rule.id);
                  }}
                >
                  <CategoryBadge category={rule.category} />
                  <span className="archive-title">{rule.title}</span>
                  {rule.description && (
                    <span className="archive-description">{rule.description}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="button button--secondary button--small archive-restore"
                  onClick={() => void restoreRule(rule)}
                  disabled={restoringId === rule.id}
                >
                  <RestoreIcon size={16} />
                  {restoringId === rule.id ? copy.common.saving : copy.rule.restore}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
