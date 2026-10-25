import { z } from "zod";
import {
  DEFAULT_LOCALE,
  FUTURE_BREAK_TOLERANCE_MS,
  LOCALES,
  type Locale,
} from "@/domain/constants";
import {
  breakChangeSchema,
  breakInputSchema,
  breakRecordSchema,
  isoDateTimeSchema,
  ruleChangeSchema,
  ruleInputSchema,
  ruleRecordSchema,
  secretRecordSchema,
} from "@/domain/schemas";
import { searchRules } from "@/domain/insights";
import type {
  BreakChange,
  BreakInput,
  BreakRecord,
  RuleChange,
  RuleInput,
  RuleRecord,
  SecretRecord,
} from "@/domain/types";
import { createId } from "@/lib/id";
import { isAfterNow } from "@/lib/dates";
import { db } from "./db";

export type RepositoryErrorCode =
  | "not_found"
  | "stale"
  | "archived"
  | "future_time"
  | "invalid_input";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

function fail(code: RepositoryErrorCode, message: string): never {
  throw new RepositoryError(code, message);
}

function canonicalIso(value: string): string {
  return new Date(value).toISOString();
}

function assertRealBreakTime(occurredAt: string, now = new Date()): void {
  if (Number.isNaN(Date.parse(occurredAt))) {
    fail("invalid_input", "Invalid break time");
  }
  if (isAfterNow(occurredAt, FUTURE_BREAK_TOLERANCE_MS, now)) {
    fail("future_time", "Break time is in the future");
  }
}

function parseOrFail<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new RepositoryError("invalid_input", "Invalid record input");
    }
    throw error;
  }
}

function makeRuleRecord(
  input: z.infer<typeof ruleInputSchema>,
  nowIso: string,
): RuleRecord {
  return {
    id: createId(),
    title: input.title,
    description: input.description,
    category: input.category,
    archived: 0,
    rev: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function makeBreakRecord(
  ruleId: string,
  input: Omit<BreakInput, "ruleId">,
  nowIso: string,
): BreakRecord {
  return {
    id: createId(),
    ruleId,
    occurredAt: canonicalIso(input.occurredAt),
    situation: input.situation,
    reflection: input.reflection,
    source: input.source,
    rev: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export interface CreateRuleResult {
  rule: RuleRecord;
  firstBreak: BreakRecord | null;
}

export async function createRule(
  rawInput: RuleInput,
  options: { source?: "manual" | "assistant"; now?: Date } = {},
): Promise<CreateRuleResult> {
  const input = parseOrFail(() => ruleInputSchema.parse(rawInput));
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const firstBreakInput = input.firstBreak;

  if (firstBreakInput) {
    assertRealBreakTime(firstBreakInput.occurredAt, now);
  }

  const rule = parseOrFail(() =>
    ruleRecordSchema.parse(makeRuleRecord(input, nowIso)),
  );
  const firstBreak = firstBreakInput
    ? parseOrFail(() =>
        breakRecordSchema.parse(
          makeBreakRecord(
            rule.id,
            {
              occurredAt: firstBreakInput.occurredAt,
              situation: firstBreakInput.situation,
              reflection: firstBreakInput.reflection,
              source: options.source ?? "manual",
            },
            nowIso,
          ),
        ),
      )
    : null;

  await db.transaction("rw", db.rules, db.breaks, async () => {
    await db.rules.add(rule);
    if (firstBreak) await db.breaks.add(firstBreak);
  });

  return { rule, firstBreak };
}

export async function updateRule(
  id: string,
  expectedRev: number,
  rawChange: RuleChange,
): Promise<RuleRecord> {
  const change = parseOrFail(() => ruleChangeSchema.parse(rawChange));

  return db.transaction("rw", db.rules, async () => {
    const current = await db.rules.get(id);
    if (!current) fail("not_found", "Rule not found");
    if (current.rev !== expectedRev) {
      fail("stale", "Rule changed elsewhere");
    }
    const next = parseOrFail(() =>
      ruleRecordSchema.parse({
        ...current,
        ...change,
        rev: current.rev + 1,
        updatedAt: new Date().toISOString(),
      }),
    );
    await db.rules.put(next);
    return next;
  });
}

export async function setRuleArchived(
  id: string,
  expectedRev: number,
  archived: boolean,
): Promise<RuleRecord> {
  return db.transaction("rw", db.rules, async () => {
    const current = await db.rules.get(id);
    if (!current) fail("not_found", "Rule not found");
    if (current.rev !== expectedRev) {
      fail("stale", "Rule changed elsewhere");
    }
    const next = parseOrFail(() =>
      ruleRecordSchema.parse({
        ...current,
        archived: archived ? 1 : 0,
        rev: current.rev + 1,
        updatedAt: new Date().toISOString(),
      }),
    );
    await db.rules.put(next);
    return next;
  });
}

export async function createBreak(
  rawInput: BreakInput,
  options: { now?: Date } = {},
): Promise<BreakRecord> {
  const input = parseOrFail(() => breakInputSchema.parse(rawInput));
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  assertRealBreakTime(input.occurredAt, now);

  return db.transaction("rw", db.rules, db.breaks, async () => {
    const rule = await db.rules.get(input.ruleId);
    if (!rule) fail("not_found", "Rule not found");
    if (rule.archived === 1) fail("archived", "Rule is archived");

    const record = parseOrFail(() =>
      breakRecordSchema.parse(
        makeBreakRecord(
          input.ruleId,
          {
            occurredAt: input.occurredAt,
            situation: input.situation,
            reflection: input.reflection,
            source: input.source,
          },
          nowIso,
        ),
      ),
    );
    await db.breaks.add(record);
    return record;
  });
}

export async function updateBreak(
  id: string,
  expectedRev: number,
  rawChange: BreakChange,
  options: { now?: Date } = {},
): Promise<BreakRecord> {
  const change = parseOrFail(() => breakChangeSchema.parse(rawChange));
  const now = options.now ?? new Date();
  assertRealBreakTime(change.occurredAt, now);

  return db.transaction("rw", db.breaks, async () => {
    const current = await db.breaks.get(id);
    if (!current) fail("not_found", "Slip not found");
    if (current.rev !== expectedRev) fail("stale", "Slip changed elsewhere");

    const next = parseOrFail(() =>
      breakRecordSchema.parse({
        ...current,
        ...change,
        occurredAt: canonicalIso(change.occurredAt),
        rev: current.rev + 1,
        updatedAt: now.toISOString(),
      }),
    );
    await db.breaks.put(next);
    return next;
  });
}

export async function deleteBreak(
  id: string,
  expectedRev: number,
): Promise<void> {
  await db.transaction("rw", db.breaks, async () => {
    const current = await db.breaks.get(id);
    if (!current) fail("not_found", "Slip not found");
    if (current.rev !== expectedRev) fail("stale", "Slip changed elsewhere");
    await db.breaks.delete(id);
  });
}

export async function ensureBootData(): Promise<Locale> {
  const current = await db.settings.get("language");
  const parsed = z.enum(LOCALES).safeParse(current?.value);
  if (parsed.success) return parsed.data;

  await db.settings.put({ key: "language", value: DEFAULT_LOCALE });
  return DEFAULT_LOCALE;
}

export async function getLanguage(fallback: Locale = DEFAULT_LOCALE): Promise<Locale> {
  const current = await db.settings.get("language");
  const parsed = z.enum(LOCALES).safeParse(current?.value);
  return parsed.success ? parsed.data : fallback;
}

export async function setLanguage(locale: Locale): Promise<void> {
  const parsed = z.enum(LOCALES).safeParse(locale);
  if (!parsed.success) fail("invalid_input", "Invalid locale");
  await db.settings.put({ key: "language", value: parsed.data });
}

export async function getDeepSeekKey(): Promise<string | null> {
  const record = await db.secrets.get("deepseek");
  if (!record) return null;
  const parsed = secretRecordSchema.parse(record);
  return parsed.value;
}

export async function saveDeepSeekKey(rawKey: string): Promise<void> {
  const value = rawKey.trim();
  if (value.length < 10 || value.length > 400 || /\s/.test(value)) {
    fail("invalid_input", "Invalid API key");
  }
  const record: SecretRecord = {
    key: "deepseek",
    value,
    updatedAt: new Date().toISOString(),
  };
  const parsed = secretRecordSchema.parse(record);
  await db.secrets.put(parsed);
}

export async function deleteDeepSeekKey(): Promise<void> {
  await db.secrets.delete("deepseek");
}

export async function getActiveRules(): Promise<RuleRecord[]> {
  const records = await db.rules.where("archived").equals(0).toArray();
  return records.map((record) => ruleRecordSchema.parse(record));
}

export async function getAllRules(): Promise<RuleRecord[]> {
  const records = await db.rules.toArray();
  return records.map((record) => ruleRecordSchema.parse(record));
}

export async function getRule(id: string): Promise<RuleRecord | null> {
  const record = await db.rules.get(id);
  return record ? ruleRecordSchema.parse(record) : null;
}

export async function searchActiveRules(query = ""): Promise<RuleRecord[]> {
  const active = (await getActiveRules()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  return searchRules(active, query).slice(0, 50);
}

export async function getAllBreaks(): Promise<BreakRecord[]> {
  const records = await db.breaks.toArray();
  return records.map((record) => breakRecordSchema.parse(record));
}

export async function getBreaksForRuleId(ruleId: string): Promise<BreakRecord[]> {
  const records = await db.breaks.where("ruleId").equals(ruleId).toArray();
  return records.map((record) => breakRecordSchema.parse(record));
}

export function parseIsoOrFail(value: string): string {
  const parsed = isoDateTimeSchema.safeParse(value);
  if (!parsed.success) fail("invalid_input", "Invalid timestamp");
  return canonicalIso(parsed.data);
}
