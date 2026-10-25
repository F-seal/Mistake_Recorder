import { beforeEach, describe, expect, it } from "vitest";
import {
  createBreak,
  createRule,
  deleteBreak,
  deleteDeepSeekKey,
  ensureBootData,
  getActiveRules,
  getAllRules,
  getBreaksForRuleId,
  getDeepSeekKey,
  getLanguage,
  getRule,
  RepositoryError,
  saveDeepSeekKey,
  searchActiveRules,
  setLanguage,
  setRuleArchived,
  updateBreak,
  updateRule,
} from "./repository";
import { resetDatabase } from "@/test/database";
import { db } from "./db";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const PAST = "2026-10-21T22:15:00.000Z";
const FUTURE = "2026-10-26T22:15:00.000Z";

beforeEach(async () => {
  await resetDatabase();
});

describe("boot data", () => {
  it("seeds Chinese once and persists language changes", async () => {
    expect(await ensureBootData()).toBe("zh-CN");
    expect(await getLanguage()).toBe("zh-CN");

    await setLanguage("en");
    expect(await ensureBootData()).toBe("en");
  });

  it("repairs an invalid stored locale", async () => {
    await db.settings.put({ key: "language", value: "fr" });
    expect(await ensureBootData()).toBe("zh-CN");
    expect(await getLanguage()).toBe("zh-CN");
  });
});

describe("rules and slips", () => {
  it("creates a trimmed rule and lists it as active", async () => {
    const { rule, firstBreak } = await createRule(
      {
        title: "  No phone in bed  ",
        description: "  Sleep first.  ",
        category: "mental",
      },
      { now: NOW },
    );

    expect(firstBreak).toBeNull();
    expect(rule).toMatchObject({
      title: "No phone in bed",
      description: "Sleep first.",
      category: "mental",
      archived: 0,
      rev: 1,
    });
    expect(await getActiveRules()).toHaveLength(1);
    expect(await getRule(rule.id)).toMatchObject({ id: rule.id });
    expect(await searchActiveRules("phone")).toHaveLength(1);
    expect(await searchActiveRules("bicycle")).toHaveLength(0);
  });

  it("creates a rule and its first slip atomically", async () => {
    const { rule, firstBreak } = await createRule(
      {
        title: "No phone in bed",
        description: "",
        category: "mental",
        firstBreak: {
          occurredAt: PAST,
          situation: "  Scrolled for forty minutes.  ",
          reflection: "Leave the phone in the living room.",
        },
      },
      { now: NOW, source: "assistant" },
    );

    expect(firstBreak).toMatchObject({
      ruleId: rule.id,
      occurredAt: PAST,
      situation: "Scrolled for forty minutes.",
      source: "assistant",
    });
    expect(await getBreaksForRuleId(rule.id)).toHaveLength(1);
  });

  it("rejects a future first slip without creating the rule", async () => {
    await expect(
      createRule(
        {
          title: "No phone in bed",
          description: "",
          category: "mental",
          firstBreak: {
            occurredAt: FUTURE,
            situation: "This has not happened yet.",
            reflection: "",
          },
        },
        { now: NOW },
      ),
    ).rejects.toMatchObject({ code: "future_time" });

    expect(await getAllRules()).toHaveLength(0);
  });

  it("increments revisions and rejects stale edits", async () => {
    const { rule } = await createRule(
      { title: "No phone in bed", description: "", category: "mental" },
      { now: NOW },
    );

    const updated = await updateRule(rule.id, rule.rev, {
      title: "No phone in bed",
      description: "A better reason.",
      category: "health",
    });
    expect(updated.rev).toBe(2);
    expect(updated.category).toBe("health");

    await expect(
      updateRule(rule.id, 1, {
        title: "Stale title",
        description: "",
        category: "mental",
      }),
    ).rejects.toMatchObject({ code: "stale" });
  });

  it("archives a rule, keeps its history, and refuses new slips", async () => {
    const { rule } = await createRule(
      { title: "No phone in bed", description: "", category: "mental" },
      { now: NOW },
    );
    await createBreak(
      {
        ruleId: rule.id,
        occurredAt: PAST,
        situation: "One slip before archiving.",
        reflection: "",
        source: "manual",
      },
      { now: NOW },
    );
    const archived = await setRuleArchived(rule.id, rule.rev, true);

    expect(archived.archived).toBe(1);
    expect(await getActiveRules()).toHaveLength(0);
    expect(await getBreaksForRuleId(rule.id)).toHaveLength(1);

    await expect(
      createBreak(
        {
          ruleId: rule.id,
          occurredAt: PAST,
          situation: "Should be refused.",
          reflection: "",
          source: "manual",
        },
        { now: NOW },
      ),
    ).rejects.toMatchObject({ code: "archived" });

    const restored = await setRuleArchived(rule.id, archived.rev, false);
    expect(restored.archived).toBe(0);
    expect(await getActiveRules()).toHaveLength(1);
  });

  it("creates, edits, and deletes slips with revision checks", async () => {
    const { rule } = await createRule(
      { title: "No phone in bed", description: "", category: "mental" },
      { now: NOW },
    );

    const slip = await createBreak(
      {
        ruleId: rule.id,
        occurredAt: PAST,
        situation: "Scrolled.",
        reflection: "",
        source: "manual",
      },
      { now: NOW },
    );
    expect(slip.rev).toBe(1);

    const edited = await updateBreak(
      slip.id,
      slip.rev,
      {
        occurredAt: PAST,
        situation: "Scrolled for half an hour.",
        reflection: "Charger moved.",
      },
      { now: NOW },
    );
    expect(edited).toMatchObject({
      rev: 2,
      situation: "Scrolled for half an hour.",
      reflection: "Charger moved.",
    });

    await expect(
      updateBreak(
        slip.id,
        slip.rev,
        { occurredAt: PAST, situation: "Stale edit", reflection: "" },
        { now: NOW },
      ),
    ).rejects.toMatchObject({ code: "stale" });

    await deleteBreak(slip.id, edited.rev);
    expect(await getBreaksForRuleId(rule.id)).toHaveLength(0);
  });

  it("rejects future and missing-rule slips", async () => {
    const { rule } = await createRule(
      { title: "No phone in bed", description: "", category: "mental" },
      { now: NOW },
    );

    await expect(
      createBreak(
        {
          ruleId: rule.id,
          occurredAt: FUTURE,
          situation: "Not yet.",
          reflection: "",
          source: "manual",
        },
        { now: NOW },
      ),
    ).rejects.toMatchObject({ code: "future_time" });

    await expect(
      createBreak(
        {
          ruleId: "missing",
          occurredAt: PAST,
          situation: "No owner.",
          reflection: "",
          source: "manual",
        },
        { now: NOW },
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects invalid input with a repository error", async () => {
    await expect(
      createRule({ title: "   ", description: "", category: "mental" }),
    ).rejects.toBeInstanceOf(RepositoryError);

    await expect(
      createRule({
        title: "Invalid category",
        description: "",
        category: "other" as never,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("API key storage", () => {
  it("stores, replaces, and removes a key", async () => {
    expect(await getDeepSeekKey()).toBeNull();
    await saveDeepSeekKey("  sk-test-key-1234567890  ");
    expect(await getDeepSeekKey()).toBe("sk-test-key-1234567890");

    await saveDeepSeekKey("sk-replacement-key");
    expect(await getDeepSeekKey()).toBe("sk-replacement-key");

    await deleteDeepSeekKey();
    expect(await getDeepSeekKey()).toBeNull();
  });

  it("rejects malformed or whitespace-containing keys", async () => {
    await expect(saveDeepSeekKey("short")).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(
      saveDeepSeekKey("sk-test key with spaces"),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
