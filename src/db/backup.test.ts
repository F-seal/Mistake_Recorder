import { beforeEach, describe, expect, it } from "vitest";
import type { BackupData } from "@/domain/types";
import {
  createBreak,
  createRule,
  getDeepSeekKey,
  getLanguage,
  getRule,
  saveDeepSeekKey,
  setLanguage,
  setRuleArchived,
} from "./repository";
import {
  BackupError,
  backupFilename,
  createBackupData,
  importBackupData,
  parseBackupJson,
  serializeBackup,
} from "./backup";
import { db } from "./db";
import { resetDatabase } from "@/test/database";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const PAST = "2026-10-21T22:15:00.000Z";
const KEY = "sk-local-secret-that-must-not-leak";

beforeEach(async () => {
  await resetDatabase();
});

async function seedArchive(): Promise<void> {
  const first = await createRule(
    {
      title: "No phone in bed",
      description: "Sleep first.",
      category: "mental",
      firstBreak: {
        occurredAt: PAST,
        situation: "Scrolled for forty minutes.",
        reflection: "Put the charger in the hall.",
      },
    },
    { now: NOW },
  );
  const second = await createRule(
    {
      title: "No skipped breakfast",
      description: "",
      category: "health",
    },
    { now: NOW },
  );
  await createBreak(
    {
      ruleId: second.rule.id,
      occurredAt: PAST,
      situation: "Coffee only.",
      reflection: "",
      source: "manual",
    },
    { now: NOW },
  );
  await setRuleArchived(first.rule.id, first.rule.rev, true);
}

describe("versioned backup", () => {
  it("exports rules and slips but never secrets or settings", async () => {
    await seedArchive();
    await saveDeepSeekKey(KEY);
    await setLanguage("en");

    const backup = await createBackupData();
    expect(backup.schemaVersion).toBe(1);
    expect(Object.keys(backup).sort()).toEqual(
      ["appVersion", "breaks", "exportedAt", "rules", "schemaVersion"].sort(),
    );
    expect(backup.rules).toHaveLength(2);
    expect(backup.breaks).toHaveLength(2);
    expect(backup.rules.some((rule) => rule.archived === 1)).toBe(true);

    const json = serializeBackup(backup);
    expect(json).not.toContain(KEY);
    expect(json).not.toContain("deepseek");
    expect(json).not.toContain('"settings"');
    expect(backupFilename(new Date(2026, 9, 25))).toBe(
      "dont-dos-backup-2026-10-25.json",
    );
  });

  it("round-trips through JSON and replaces records while preserving the key and language", async () => {
    await seedArchive();
    await saveDeepSeekKey(KEY);
    await setLanguage("en");
    const backup = await createBackupData();
    const parsed = parseBackupJson(serializeBackup(backup));
    expect(parsed).toEqual(backup);

    await db.rules.clear();
    await db.breaks.clear();
    const extra = await createRule(
      { title: "Temporary rule", description: "", category: "career" },
      { now: NOW },
    );
    expect(await db.rules.count()).toBe(1);

    await importBackupData(parsed);

    expect(await db.rules.count()).toBe(2);
    expect(await db.breaks.count()).toBe(2);
    expect(await db.rules.get(extra.rule.id)).toBeUndefined();
    expect(await getDeepSeekKey()).toBe(KEY);
    expect(await getLanguage()).toBe("en");
  });

  it("rejects malformed JSON and unsupported schema versions", async () => {
    expect(() => parseBackupJson("{")).toThrow(BackupError);

    const backup = await createBackupData();
    const wrongVersion = { ...backup, schemaVersion: 2 };
    expect(() => parseBackupJson(JSON.stringify(wrongVersion))).toThrow(
      BackupError,
    );
  });

  it("rejects duplicate ids, orphaned slips, and unknown fields before mutation", async () => {
    await seedArchive();
    const backup = await createBackupData();
    const beforeRules = await db.rules.count();
    const beforeBreaks = await db.breaks.count();

    const duplicate = {
      ...backup,
      rules: [...backup.rules, { ...backup.rules[0], title: "Duplicate" }],
    } as BackupData;
    await expect(importBackupData(duplicate)).rejects.toBeInstanceOf(
      BackupError,
    );

    const orphan = {
      ...backup,
      breaks: [{ ...backup.breaks[0], ruleId: "missing" }],
    } as BackupData;
    await expect(importBackupData(orphan)).rejects.toBeInstanceOf(BackupError);

    const extraField = {
      ...backup,
      rules: [{ ...backup.rules[0], stray: true }],
    } as unknown as BackupData;
    await expect(importBackupData(extraField)).rejects.toBeInstanceOf(
      BackupError,
    );

    expect(await db.rules.count()).toBe(beforeRules);
    expect(await db.breaks.count()).toBe(beforeBreaks);
  });

  it("validates that every break belongs to an exported rule", async () => {
    await seedArchive();
    const backup = await createBackupData();
    const withoutRules = { ...backup, rules: [] } as BackupData;
    expect(() => parseBackupJson(JSON.stringify(withoutRules))).toThrow(
      BackupError,
    );
  });

  it("keeps a valid archived rule available after restore", async () => {
    await seedArchive();
    const backup = await createBackupData();
    const archived = backup.rules.find((rule) => rule.archived === 1);
    expect(archived).toBeDefined();

    await importBackupData(backup);
    const restored = await getRule(archived?.id ?? "");
    expect(restored?.archived).toBe(1);
  });
});
