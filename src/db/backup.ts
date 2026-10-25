import { APP_SCHEMA_VERSION } from "@/domain/constants";
import { backupSchema } from "@/domain/schemas";
import type { BackupData, BreakRecord, RuleRecord } from "@/domain/types";
import { APP_VERSION } from "@/lib/appInfo";
import { db } from "./db";

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

function assertUniqueIds(
  records: readonly { id: string }[],
  label: string,
): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      throw new BackupError(`Duplicate ${label} id in backup`);
    }
    ids.add(record.id);
  }
}

function assertBreakOwners(
  rules: readonly RuleRecord[],
  breaks: readonly BreakRecord[],
): void {
  const ruleIds = new Set(rules.map((rule) => rule.id));
  for (const record of breaks) {
    if (!ruleIds.has(record.ruleId)) {
      throw new BackupError("A slip refers to a missing rule");
    }
  }
}

function validateBackup(backup: BackupData): BackupData {
  let parsed: BackupData;
  try {
    parsed = backupSchema.parse(backup);
  } catch {
    throw new BackupError("Backup has an unsupported shape or version");
  }
  assertUniqueIds(parsed.rules, "rule");
  assertUniqueIds(parsed.breaks, "slip");
  assertBreakOwners(parsed.rules, parsed.breaks);
  return parsed;
}

export async function createBackupData(): Promise<BackupData> {
  const [rules, breaks] = await Promise.all([
    db.rules.toArray(),
    db.breaks.toArray(),
  ]);

  rules.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  breaks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return {
    schemaVersion: APP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    rules,
    breaks,
  };
}

export function serializeBackup(backup: BackupData): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function backupFilename(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `zuofei-backup-${stamp}.json`;
}

export function parseBackupJson(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("Backup is not valid JSON");
  }

  return validateBackup(raw as BackupData);
}

export async function importBackupData(backup: BackupData): Promise<void> {
  const parsed = validateBackup(backup);

  await db.transaction("rw", db.rules, db.breaks, async () => {
    await db.rules.clear();
    await db.breaks.clear();
    if (parsed.rules.length) await db.rules.bulkPut(parsed.rules);
    if (parsed.breaks.length) await db.breaks.bulkPut(parsed.breaks);
  });
}
