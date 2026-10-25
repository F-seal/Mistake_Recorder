import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { LOCALES, type Locale } from "@/domain/constants";
import type { BackupData } from "@/domain/types";
import {
  createBackupData,
  backupFilename,
  importBackupData,
  parseBackupJson,
  serializeBackup,
} from "@/db/backup";
import {
  deleteDeepSeekKey,
  getDeepSeekKey,
  saveDeepSeekKey,
} from "@/db/repository";
import { DeepSeekError, testDeepSeekKey } from "@/ai/deepseek";
import { useI18n } from "@/i18n/I18nProvider";
import { APP_VERSION } from "@/lib/appInfo";
import { readFileText, shareOrDownloadJson } from "@/lib/files";
import { ConfirmDialog, Sheet } from "@/components/Sheet";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  DownloadIcon,
  KeyIcon,
  UploadIcon,
} from "@/components/Icons";

interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onDataImported?: () => void;
}

type KeyStatus =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function SettingsScreen({
  open,
  onClose,
  locale,
  onLocaleChange,
  onDataImported,
}: SettingsScreenProps) {
  const { copy } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ kind: "idle" });
  const [savingKey, setSavingKey] = useState(false);
  const [removeKeyOpen, setRemoveKeyOpen] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [dataStatus, setDataStatus] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [importCandidate, setImportCandidate] = useState<BackupData | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setKeyStatus({ kind: "idle" });
    setKeyDraft("");
    setImportCandidate(null);
    setImportConfirmOpen(false);
    setDataStatus(null);
    void getDeepSeekKey()
      .then((value) => {
        if (active) setHasKey(Boolean(value));
      })
      .catch(() => {
        if (active) setHasKey(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  function errorMessage(error: unknown): string {
    if (error instanceof DeepSeekError) return copy.ai.errors[error.code];
    return copy.ai.errors.unknown;
  }

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    const value = keyDraft.trim();
    if (!value) {
      setKeyStatus({ kind: "error", message: copy.settings.keyMissing });
      return;
    }
    setSavingKey(true);
    try {
      await saveDeepSeekKey(value);
      setHasKey(true);
      setKeyDraft("");
      setKeyStatus({ kind: "success", message: copy.settings.keySaved });
    } catch {
      setKeyStatus({ kind: "error", message: copy.errors.saveFailed });
    } finally {
      setSavingKey(false);
    }
  }

  async function testKey() {
    setKeyStatus({ kind: "testing" });
    try {
      const value = keyDraft.trim() || (await getDeepSeekKey());
      if (!value) {
        setKeyStatus({ kind: "error", message: copy.settings.keyMissing });
        return;
      }
      await testDeepSeekKey(value);
      setKeyStatus({ kind: "success", message: copy.settings.keyWorks });
    } catch (error) {
      setKeyStatus({ kind: "error", message: errorMessage(error) });
    }
  }

  async function removeKey() {
    if (removingKey) return;
    setRemovingKey(true);
    try {
      await deleteDeepSeekKey();
      setHasKey(false);
      setKeyDraft("");
      setKeyStatus({ kind: "success", message: copy.settings.keyRemoved });
      setRemoveKeyOpen(false);
    } catch {
      setKeyStatus({ kind: "error", message: copy.errors.generic });
      setRemoveKeyOpen(false);
    } finally {
      setRemovingKey(false);
    }
  }

  async function exportBackup() {
    if (exporting) return;
    setExporting(true);
    try {
      const backup = await createBackupData();
      if (backup.rules.length === 0 && backup.breaks.length === 0) {
        setDataStatus({ kind: "error", message: copy.settings.noData });
        return;
      }
      const outcome = await shareOrDownloadJson(
        serializeBackup(backup),
        backupFilename(),
      );
      if (outcome !== "cancelled") {
        setDataStatus({ kind: "success", message: copy.settings.exportDone });
      }
    } catch {
      setDataStatus({ kind: "error", message: copy.errors.generic });
    } finally {
      setExporting(false);
    }
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await readFileText(file);
      const parsed = parseBackupJson(text);
      setImportCandidate(parsed);
      setImportConfirmOpen(true);
    } catch {
      setDataStatus({ kind: "error", message: copy.settings.importFailed });
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!importCandidate) return;
    setImporting(true);
    try {
      await importBackupData(importCandidate);
      setImportConfirmOpen(false);
      setImportCandidate(null);
      setDataStatus({ kind: "success", message: copy.settings.importDone });
      onDataImported?.();
    } catch {
      setImportConfirmOpen(false);
      setImportCandidate(null);
      setDataStatus({ kind: "error", message: copy.errors.importFailed });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={copy.settings.title}
        variant="tall"
        dismissible={!savingKey && !importing}
        footer={
          <div className="button-row">
            <button type="button" className="button button--primary" onClick={onClose}>
              {copy.settings.close}
            </button>
          </div>
        }
      >
        <div className="settings-sections">
          <section className="settings-section">
            <h3 className="settings-heading">{copy.settings.language}</h3>
            <SegmentedControl
              options={LOCALES.map((value) => ({
                id: value,
                label:
                  value === "zh-CN"
                    ? copy.settings.chinese
                    : copy.settings.english,
              }))}
              value={locale}
              onChange={onLocaleChange}
              ariaLabel={copy.settings.language}
            />
            <p className="settings-note">{copy.settings.languageNote}</p>
          </section>

          <section className="settings-section">
            <div className="settings-heading-row">
              <h3 className="settings-heading">{copy.settings.aiSection}</h3>
              <span className="settings-heading-icon" aria-hidden="true">
                <KeyIcon size={17} />
              </span>
            </div>
            <p className="settings-note">{copy.settings.aiSectionHint}</p>

            <form className="key-form" onSubmit={saveKey}>
              <label className="field-label" htmlFor="deepseek-key">
                {copy.settings.aiKeyLabel}
              </label>
              <div className="key-input-row">
                <input
                  id="deepseek-key"
                  type="password"
                  className="text-input"
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  placeholder={copy.settings.aiKeyPlaceholder}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  className="button button--primary button--small"
                  disabled={savingKey || !keyDraft.trim()}
                >
                  {savingKey ? copy.common.saving : copy.settings.saveKey}
                </button>
              </div>
            </form>

            <div className="key-state-row">
              <span className={`key-dot${hasKey ? " key-dot--on" : ""}`} aria-hidden="true" />
              <span>{hasKey ? copy.settings.aiKeySet : copy.settings.aiKeyUnset}</span>
            </div>

            <div className="key-actions">
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => void testKey()}
                disabled={keyStatus.kind === "testing"}
              >
                {keyStatus.kind === "testing"
                  ? copy.settings.testing
                  : copy.settings.testKey}
              </button>
              {hasKey && (
                <button
                  type="button"
                  className="button button--quiet button--small danger-text"
                  onClick={() => setRemoveKeyOpen(true)}
                >
                  {copy.settings.removeKey}
                </button>
              )}
            </div>

            <div className="settings-status" aria-live="polite">
              {keyStatus.kind === "success" && (
                <p className="status-note status-note--success">{keyStatus.message}</p>
              )}
              {keyStatus.kind === "error" && (
                <p className="status-note status-note--error">{keyStatus.message}</p>
              )}
            </div>

            <p className="settings-fineprint">{copy.settings.aiKeyNote}</p>
            <p className="settings-fineprint">{copy.settings.keySecurity}</p>
          </section>

          <section className="settings-section">
            <h3 className="settings-heading">{copy.settings.dataSection}</h3>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-action"
                onClick={() => void exportBackup()}
                disabled={exporting}
              >
                <span className="settings-action-icon" aria-hidden="true">
                  <DownloadIcon size={19} />
                </span>
                <span className="settings-action-copy">
                  <span className="settings-action-title">
                    {copy.settings.exportData}
                  </span>
                  <span className="settings-action-note">
                    {exporting ? copy.settings.exportPreparing : copy.settings.exportNote}
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="settings-action"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <span className="settings-action-icon" aria-hidden="true">
                  <UploadIcon size={19} />
                </span>
                <span className="settings-action-copy">
                  <span className="settings-action-title">
                    {copy.settings.importData}
                  </span>
                  <span className="settings-action-note">
                    {importing ? copy.settings.importReading : copy.settings.importNote}
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={(event) => void chooseImport(event)}
              />
            </div>
            {dataStatus && (
              <p
                className={`status-note status-note--${
                  dataStatus.kind === "success" ? "success" : "error"
                }`}
                role="status"
              >
                {dataStatus.message}
              </p>
            )}
          </section>

          <section className="settings-section">
            <h3 className="settings-heading">{copy.settings.aboutSection}</h3>
            <dl className="about-list">
              <div>
                <dt>{copy.settings.version}</dt>
                <dd>{APP_VERSION}</dd>
              </div>
            </dl>
            <p className="settings-fineprint">{copy.settings.privacy}</p>
            <p className="settings-fineprint">{copy.settings.installNote}</p>
            <p className="settings-fineprint">{copy.settings.storageNote}</p>
          </section>
        </div>
      </Sheet>

      <ConfirmDialog
        open={removeKeyOpen}
        onClose={() => setRemoveKeyOpen(false)}
        onConfirm={() => void removeKey()}
        title={copy.settings.removeKeyTitle}
        body={copy.settings.removeKeyBody}
        confirmLabel={copy.settings.removeKey}
        cancelLabel={copy.common.cancel}
        danger
        busy={removingKey}
      />

      <ConfirmDialog
        open={importConfirmOpen && Boolean(importCandidate)}
        onClose={() => {
          setImportConfirmOpen(false);
          setImportCandidate(null);
        }}
        onConfirm={() => void confirmImport()}
        title={copy.settings.importConfirmTitle}
        body={
          importCandidate
            ? copy.settings.importConfirmBody(
                importCandidate.rules.length,
                importCandidate.breaks.length,
              )
            : ""
        }
        confirmLabel={copy.settings.importData}
        cancelLabel={copy.common.cancel}
        danger
        busy={importing}
      />
    </>
  );
}
