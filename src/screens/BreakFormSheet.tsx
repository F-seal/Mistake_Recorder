import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  FUTURE_BREAK_TOLERANCE_MS,
  type Locale,
} from "@/domain/constants";
import type { BreakRecord, RuleRecord } from "@/domain/types";
import {
  createBreak,
  deleteBreak,
  RepositoryError,
  updateBreak,
} from "@/db/repository";
import { useI18n } from "@/i18n/I18nProvider";
import {
  fromLocalDateTimeInput,
  isFutureOrInvalidBreak,
  nowForDateTimeInput,
  toLocalDateTimeInput,
} from "@/lib/dates";
import { CategoryBadge } from "@/components/CategoryMark";
import { ConfirmDialog, Sheet } from "@/components/Sheet";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { SearchIcon } from "@/components/Icons";

interface BreakFormSheetProps {
  open: boolean;
  mode: "create" | "edit";
  rules: RuleRecord[];
  rule?: RuleRecord | null;
  record?: BreakRecord | null;
  onClose: () => void;
  onCreateRule?: () => void;
  onSaved?: (record: BreakRecord) => void;
}

function sortRules(rules: RuleRecord[], locale: Locale): RuleRecord[] {
  return [...rules].sort((left, right) =>
    left.title.localeCompare(right.title, locale),
  );
}

export function BreakFormSheet({
  open,
  mode,
  rules,
  rule,
  record,
  onClose,
  onCreateRule,
  onSaved,
}: BreakFormSheetProps) {
  const { locale, copy } = useI18n();
  const { showToast } = useToast();
  const situationRef = useRef<HTMLTextAreaElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [occurredAtInput, setOccurredAtInput] = useState(nowForDateTimeInput());
  const [situation, setSituation] = useState("");
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeRules = useMemo(
    () => sortRules(rules.filter((item) => item.archived === 0), locale),
    [rules, locale],
  );

  const selectedRule = useMemo(() => {
    if (mode === "edit" && rule) return rule;
    const id = selectedRuleId;
    return rules.find((item) => item.id === id) ?? null;
  }, [mode, rule, rules, selectedRuleId]);

  const pickerResults = useMemo(() => {
    const query = pickerQuery.trim().toLocaleLowerCase();
    if (!query) return activeRules;
    return activeRules.filter((item) =>
      `${item.title}\n${item.description}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [activeRules, pickerQuery]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setDeleting(false);
    setDeleteOpen(false);
    setPickerQuery("");
    if (mode === "edit" && record) {
      setSelectedRuleId(record.ruleId);
      setOccurredAtInput(toLocalDateTimeInput(record.occurredAt));
      setSituation(record.situation);
      setReflection(record.reflection);
    } else {
      setSelectedRuleId(rule?.id ?? null);
      setOccurredAtInput(nowForDateTimeInput());
      setSituation("");
      setReflection("");
    }
  }, [open, mode, record?.id, rule?.id]);

  function chooseRule(nextRule: RuleRecord) {
    setSelectedRuleId(nextRule.id);
    setError(null);
  }

  function changeRule() {
    setSelectedRuleId(null);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    if (!selectedRule) {
      setError(copy.breakForm.selectRule);
      return;
    }

    const trimmedSituation = situation.trim();
    if (!trimmedSituation) {
      setError(copy.breakForm.invalidSituation);
      situationRef.current?.focus();
      return;
    }

    const occurredAt = fromLocalDateTimeInput(occurredAtInput);
    if (!occurredAt) {
      setError(copy.breakForm.invalidDate);
      timeRef.current?.focus();
      return;
    }

    if (isFutureOrInvalidBreak(occurredAt, FUTURE_BREAK_TOLERANCE_MS)) {
      setError(copy.breakForm.futureDate);
      timeRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved =
        mode === "edit" && record
          ? await updateBreak(record.id, record.rev, {
              occurredAt,
              situation: trimmedSituation,
              reflection: reflection.trim(),
            })
          : await createBreak({
              ruleId: selectedRule.id,
              occurredAt,
              situation: trimmedSituation,
              reflection: reflection.trim(),
              source: "manual",
            });
      showToast(
        mode === "edit" ? copy.breakForm.updated : copy.breakForm.created,
      );
      onSaved?.(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof RepositoryError) {
        if (caught.code === "future_time") {
          setError(copy.breakForm.futureDate);
        } else if (caught.code === "archived") {
          setError(copy.errors.ruleArchived);
        } else if (caught.code === "stale") {
          setError(copy.errors.stale);
        } else if (caught.code === "not_found") {
          setError(copy.errors.ruleMissingForBreak);
        } else {
          setError(copy.errors.saveFailed);
        }
      } else {
        setError(copy.errors.saveFailed);
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!record || deleting) return;
    setDeleting(true);
    try {
      await deleteBreak(record.id, record.rev);
      setDeleteOpen(false);
      showToast(copy.breakForm.deleted);
      onClose();
    } catch (caught) {
      if (caught instanceof RepositoryError && caught.code === "stale") {
        setError(copy.errors.stale);
      } else {
        setError(copy.errors.deleteFailed);
      }
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  const showRulePicker = mode === "create" && !selectedRule;
  const sheetTitle = showRulePicker
    ? copy.breakForm.chooseRuleTitle
    : mode === "edit"
      ? copy.breakForm.editTitle
      : copy.breakForm.newTitle;

  const footer = showRulePicker ? undefined : (
    <div className={`form-actions${mode === "edit" ? " form-actions--with-delete" : ""}`}>
      {mode === "edit" && (
        <button
          type="button"
          className="button button--quiet danger-text"
          onClick={() => setDeleteOpen(true)}
          disabled={saving}
        >
          {copy.breakForm.deleteSlip}
        </button>
      )}
      <div className="form-actions-right">
        <button
          type="button"
          className="button button--quiet"
          onClick={onClose}
          disabled={saving}
        >
          {copy.common.cancel}
        </button>
        <button
          type="submit"
          form="break-form"
          className="button button--primary"
          disabled={saving}
        >
          {saving ? copy.common.saving : copy.breakForm.save}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={sheetTitle}
        dismissible={!saving}
        footer={footer}
      >
        {showRulePicker ? (
          activeRules.length === 0 ? (
            <EmptyState
              title={copy.breakForm.noRules}
              body={copy.rulebook.noRulesBody}
              actionLabel={onCreateRule ? copy.rulebook.newRule : undefined}
              onAction={onCreateRule}
            />
          ) : (
            <div className="rule-picker">
              <div className="search-field">
                <SearchIcon size={18} className="search-field-icon" />
                <input
                  type="search"
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder={copy.breakForm.chooseRulePlaceholder}
                  aria-label={copy.breakForm.chooseRulePlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {pickerResults.length === 0 ? (
                <p className="quiet-note">{copy.rulebook.noMatchesBody}</p>
              ) : (
                <ul className="picker-list">
                  {pickerResults.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="picker-option"
                        onClick={() => chooseRule(item)}
                      >
                        <span className="picker-kicker">
                          <CategoryBadge category={item.category} />
                        </span>
                        <span className="picker-title">{item.title}</span>
                        {item.description && (
                          <span className="picker-description">
                            {item.description}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        ) : (
          <form id="break-form" className="form-stack" onSubmit={submit} noValidate>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            {selectedRule && (
              <div className="selected-rule" data-category={selectedRule.category}>
                <div>
                  <CategoryBadge category={selectedRule.category} />
                  <p className="selected-rule-title">{selectedRule.title}</p>
                </div>
                {mode === "create" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={changeRule}
                    disabled={saving}
                  >
                    {copy.breakForm.changeRule}
                  </button>
                )}
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="break-time">
                {copy.breakForm.timeLabel}
              </label>
              <input
                ref={timeRef}
                id="break-time"
                type="datetime-local"
                className="text-input"
                value={occurredAtInput}
                max={nowForDateTimeInput()}
                onChange={(event) => setOccurredAtInput(event.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="break-situation">
                {copy.breakForm.situationLabel}
              </label>
              <textarea
                ref={situationRef}
                id="break-situation"
                className="text-area"
                rows={4}
                value={situation}
                onChange={(event) => setSituation(event.target.value)}
                placeholder={copy.breakForm.situationPlaceholder}
                maxLength={2000}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="break-reflection">
                {copy.breakForm.reflectionLabel}{" "}
                <span className="field-optional">{copy.common.optional}</span>
              </label>
              <textarea
                id="break-reflection"
                className="text-area"
                rows={3}
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                placeholder={copy.breakForm.reflectionPlaceholder}
                maxLength={2000}
              />
            </div>
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title={copy.breakForm.deleteTitle}
        body={copy.breakForm.deleteBody}
        confirmLabel={copy.common.delete}
        cancelLabel={copy.common.cancel}
        danger
        busy={deleting}
      />
    </>
  );
}
