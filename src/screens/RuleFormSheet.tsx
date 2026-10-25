import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CATEGORIES,
  FUTURE_BREAK_TOLERANCE_MS,
  MAX_RULE_DESCRIPTION_LENGTH,
  MAX_RULE_TITLE_LENGTH,
  type CategoryId,
} from "@/domain/constants";
import type { RuleRecord } from "@/domain/types";
import { createRule, RepositoryError, updateRule } from "@/db/repository";
import { useI18n } from "@/i18n/I18nProvider";
import {
  fromLocalDateTimeInput,
  isFutureOrInvalidBreak,
  nowForDateTimeInput,
} from "@/lib/dates";
import { CategoryMark } from "@/components/CategoryMark";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";

interface RuleFormSheetProps {
  open: boolean;
  mode: "new" | "edit";
  rule?: RuleRecord | null;
  initialCategory?: CategoryId;
  onClose: () => void;
  onSaved: (rule: RuleRecord, mode: "new" | "edit") => void;
}

export function RuleFormSheet({
  open,
  mode,
  rule,
  initialCategory,
  onClose,
  onSaved,
}: RuleFormSheetProps) {
  const { copy } = useI18n();
  const { showToast } = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const situationRef = useRef<HTMLTextAreaElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId>("health");
  const [logFirstSlip, setLogFirstSlip] = useState(false);
  const [occurredAtInput, setOccurredAtInput] = useState(nowForDateTimeInput());
  const [situation, setSituation] = useState("");
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(mode === "edit" ? (rule?.title ?? "") : "");
    setDescription(mode === "edit" ? (rule?.description ?? "") : "");
    setCategory(
      mode === "edit"
        ? (rule?.category ?? "health")
        : (initialCategory ?? "health"),
    );
    setLogFirstSlip(false);
    setOccurredAtInput(nowForDateTimeInput());
    setSituation("");
    setReflection("");
    setError(null);
    setSaving(false);
  }, [open, mode, rule?.id, rule?.title, rule?.description, rule?.category, initialCategory]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(copy.rule.invalidTitle);
      titleRef.current?.focus();
      return;
    }

    let firstBreak:
      | { occurredAt: string; situation: string; reflection: string }
      | undefined;

    if (mode === "new" && logFirstSlip) {
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
      if (
        isFutureOrInvalidBreak(
          occurredAt,
          FUTURE_BREAK_TOLERANCE_MS,
        )
      ) {
        setError(copy.breakForm.futureDate);
        timeRef.current?.focus();
        return;
      }
      firstBreak = {
        occurredAt,
        situation: trimmedSituation,
        reflection: reflection.trim(),
      };
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "edit" && rule) {
        const updated = await updateRule(rule.id, rule.rev, {
          title: trimmedTitle,
          description: description.trim(),
          category,
        });
        showToast(copy.rule.updated);
        onSaved(updated, "edit");
        onClose();
      } else {
        const created = await createRule(
          {
            title: trimmedTitle,
            description: description.trim(),
            category,
            ...(firstBreak ? { firstBreak } : {}),
          },
          { source: "manual" },
        );
        showToast(copy.rule.created);
        onSaved(created.rule, "new");
        onClose();
      }
    } catch (caught) {
      if (caught instanceof RepositoryError) {
        if (caught.code === "future_time") setError(copy.breakForm.futureDate);
        else if (caught.code === "stale") setError(copy.errors.stale);
        else if (caught.code === "not_found") setError(copy.errors.recordNotFound);
        else if (caught.code === "invalid_input") setError(copy.errors.saveFailed);
        else setError(copy.errors.saveFailed);
      } else {
        setError(copy.errors.saveFailed);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "edit" ? copy.rule.editTitle : copy.rule.newTitle}
      dismissible={!saving}
      footer={
        <div className="button-row">
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
            form="rule-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? copy.common.saving : copy.rule.save}
          </button>
        </div>
      }
    >
      <form id="rule-form" className="form-stack" onSubmit={submit} noValidate>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="field-group">
          <label className="field-label" htmlFor="rule-title">
            {copy.rule.titleLabel}
          </label>
          <input
            ref={titleRef}
            id="rule-title"
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.rule.titlePlaceholder}
            maxLength={MAX_RULE_TITLE_LENGTH}
            autoComplete="off"
            enterKeyHint="next"
          />
        </div>

        <fieldset className="field-group category-fieldset">
          <legend className="field-label">{copy.rule.categoryLabel}</legend>
          <div className="category-choice-row">
            {CATEGORIES.map((id) => (
              <button
                key={id}
                type="button"
                className={`category-choice${
                  category === id ? " category-choice--active" : ""
                }`}
                data-category={id}
                aria-pressed={category === id}
                onClick={() => setCategory(id)}
              >
                <CategoryMark category={id} size={8} />
                <span>{copy.categories[id]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field-group">
          <label className="field-label" htmlFor="rule-description">
            {copy.rule.descriptionLabel}
          </label>
          <textarea
            id="rule-description"
            className="text-area"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={copy.rule.descriptionPlaceholder}
            maxLength={MAX_RULE_DESCRIPTION_LENGTH}
          />
        </div>

        {mode === "new" && (
          <section className="first-break-block">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={logFirstSlip}
                onChange={(event) => setLogFirstSlip(event.target.checked)}
              />
              <span>
                <span className="checkbox-title">{copy.rule.firstBreakToggle}</span>
                <span className="checkbox-hint">{copy.rule.firstBreakHint}</span>
              </span>
            </label>

            {logFirstSlip && (
              <div className="first-break-fields">
                <div className="field-group">
                  <label className="field-label" htmlFor="first-break-time">
                    {copy.breakForm.timeLabel}
                  </label>
                  <input
                    ref={timeRef}
                    id="first-break-time"
                    type="datetime-local"
                    className="text-input"
                    value={occurredAtInput}
                    max={nowForDateTimeInput()}
                    onChange={(event) => setOccurredAtInput(event.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="first-break-situation">
                    {copy.breakForm.situationLabel}
                  </label>
                  <textarea
                    ref={situationRef}
                    id="first-break-situation"
                    className="text-area"
                    rows={3}
                    value={situation}
                    onChange={(event) => setSituation(event.target.value)}
                    placeholder={copy.breakForm.situationPlaceholder}
                    maxLength={2000}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="first-break-reflection">
                    {copy.breakForm.reflectionLabel}{" "}
                    <span className="field-optional">{copy.common.optional}</span>
                  </label>
                  <textarea
                    id="first-break-reflection"
                    className="text-area"
                    rows={2}
                    value={reflection}
                    onChange={(event) => setReflection(event.target.value)}
                    placeholder={copy.breakForm.reflectionPlaceholder}
                    maxLength={2000}
                  />
                </div>
              </div>
            )}
          </section>
        )}
      </form>
    </Sheet>
  );
}
