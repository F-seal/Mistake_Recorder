import { describe, expect, it } from "vitest";
import {
  breaksForDay,
  buildInsights,
  decorateRules,
  searchRules,
  sortRulesForList,
} from "./insights";
import type { BreakRecord, RuleRecord } from "./types";
import { breakRecord, localIso, ruleRecord } from "@/test/database";

const NOW = new Date(2026, 9, 25, 12, 0, 0, 0);

function rule(
  id: string,
  category: RuleRecord["category"],
  overrides: Partial<RuleRecord> = {},
): RuleRecord {
  return ruleRecord({
    id,
    title: `Rule ${id}`,
    category,
    ...overrides,
  });
}

function slip(
  id: string,
  ruleId: string,
  dateKey: string,
  overrides: Partial<BreakRecord> = {},
): BreakRecord {
  return breakRecord({
    id,
    ruleId,
    occurredAt: localIso(dateKey, 20),
    ...overrides,
  });
}

describe("insights", () => {
  const rules = [
    rule("a", "health"),
    rule("b", "mental", {
      archived: 1,
      title: "A replaced habit",
      updatedAt: "2026-10-20T00:00:00.000Z",
    }),
    rule("c", "health", { title: "A second health rule" }),
  ];

  const breaks = [
    slip("1", "a", "2026-10-20"),
    slip("2", "a", "2026-10-21"),
    slip("3", "a", "2026-09-20"),
    slip("4", "b", "2026-10-24"),
    slip("5", "c", "2026-10-10"),
    slip("6", "c", "2026-08-01"),
    slip("7", "a", "2026-10-26"), // future: ignored
    slip("8", "missing", "2026-10-22"), // orphan: ignored
  ];

  it("counts this month, recent, and all-time slips", () => {
    const insights = buildInsights(rules, breaks, NOW);
    expect(insights.thisMonth).toBe(4);
    expect(insights.recent).toBe(4);
    expect(insights.total).toBe(6);
    expect(insights.categoriesAll.find((item) => item.category === "health")?.count).toBe(5);
    expect(insights.categoriesAll.find((item) => item.category === "mental")?.count).toBe(1);
    expect(insights.categoriesRecent.find((item) => item.category === "health")?.count).toBe(3);
    expect(insights.categoriesRecent.find((item) => item.category === "mental")?.count).toBe(1);
  });

  it("ranks rules by count and includes archived rules", () => {
    const insights = buildInsights(rules, breaks, NOW);
    expect(insights.rulesAll.map((entry) => entry.rule.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(insights.rulesRecent.map((entry) => entry.rule.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(insights.rulesAll[0].count).toBe(3);
    expect(insights.rulesAll[1].count).toBe(2);
    expect(insights.rulesAll[2].count).toBe(1);
  });

  it("decorates and sorts rules by most recent activity", () => {
    const decorated = decorateRules(rules, breaks);
    const sorted = sortRulesForList(decorated);
    const sortedActive = sorted.map((entry) => entry.id);
    expect(sortedActive).toEqual(["b", "a", "c"]);
    expect(sorted.find((entry) => entry.id === "a")?.breakCount).toBe(3);
    expect(sorted.find((entry) => entry.id === "a")?.lastBreakAt).toBe(
      localIso("2026-10-21", 20),
    );
  });

  it("finds slips on a local day and searches title or description", () => {
    expect(breaksForDay(breaks, "2026-10-20")).toHaveLength(1);
    const searchable = rules.map((entry, index) => ({
      ...entry,
      description: index === 0 ? "phone at night" : "",
    }));
    expect(searchRules(searchable, "PHONE")).toHaveLength(1);
    expect(searchRules(searchable, "  ")).toHaveLength(rules.length);
  });
});
