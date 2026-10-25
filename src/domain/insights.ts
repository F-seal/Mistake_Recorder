import type {
  BreakRecord,
  CategoryCount,
  InsightSnapshot,
  RuleCount,
  RuleRecord,
  RuleWithMeta,
} from "./types";
import { CATEGORIES, type CategoryId } from "./constants";
import {
  addLocalDays,
  compareDateKeys,
  localDateKey,
  localDateKeyFromIso,
} from "@/lib/dates";

function emptyCategoryCounts(): CategoryCount[] {
  return CATEGORIES.map((category) => ({ category, count: 0 }));
}

function incrementCategory(
  counts: Map<CategoryId, number>,
  category: CategoryId,
): void {
  counts.set(category, (counts.get(category) ?? 0) + 1);
}

function compareCategoryCounts(left: CategoryCount, right: CategoryCount): number {
  return (
    right.count - left.count ||
    CATEGORIES.indexOf(left.category) - CATEGORIES.indexOf(right.category)
  );
}

function compareRuleCounts(left: RuleCount, right: RuleCount): number {
  return (
    right.count - left.count ||
    right.rule.updatedAt.localeCompare(left.rule.updatedAt) ||
    left.rule.title.localeCompare(right.rule.title)
  );
}

export function breakDateKey(record: BreakRecord): string {
  return localDateKeyFromIso(record.occurredAt);
}

export function buildInsights(
  rules: readonly RuleRecord[],
  breaks: readonly BreakRecord[],
  now = new Date(),
): InsightSnapshot {
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const todayKey = localDateKey(now);
  const recentStartKey = localDateKey(addLocalDays(now, -29));
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-`;

  const allCategoryCounts = new Map<CategoryId, number>();
  const recentCategoryCounts = new Map<CategoryId, number>();
  const allRuleCounts = new Map<string, number>();
  const recentRuleCounts = new Map<string, number>();
  const lastBreakByRule = new Map<string, string>();

  let recent = 0;
  let thisMonth = 0;

  for (const record of breaks) {
    const rule = ruleById.get(record.ruleId);
    if (!rule) continue;

    const dateKey = breakDateKey(record);
    if (compareDateKeys(dateKey, todayKey) > 0) continue;

    const isRecent = compareDateKeys(dateKey, recentStartKey) >= 0;
    const isThisMonth = dateKey.startsWith(monthPrefix);

    if (isRecent) recent += 1;
    if (isThisMonth) thisMonth += 1;

    incrementCategory(allCategoryCounts, rule.category);
    allRuleCounts.set(rule.id, (allRuleCounts.get(rule.id) ?? 0) + 1);

    if (isRecent) {
      incrementCategory(recentCategoryCounts, rule.category);
      recentRuleCounts.set(rule.id, (recentRuleCounts.get(rule.id) ?? 0) + 1);
    }

    const previous = lastBreakByRule.get(rule.id);
    if (!previous || record.occurredAt > previous) {
      lastBreakByRule.set(rule.id, record.occurredAt);
    }
  }

  const categoriesAll = emptyCategoryCounts()
    .map((entry) => ({
      category: entry.category,
      count: allCategoryCounts.get(entry.category) ?? 0,
    }))
    .sort(compareCategoryCounts);

  const categoriesRecent = emptyCategoryCounts()
    .map((entry) => ({
      category: entry.category,
      count: recentCategoryCounts.get(entry.category) ?? 0,
    }))
    .sort(compareCategoryCounts);

  const rulesAll = [...allRuleCounts.entries()]
    .map(([id, count]) => ({ rule: ruleById.get(id) as RuleRecord, count }))
    .sort(compareRuleCounts);

  const rulesRecent = [...recentRuleCounts.entries()]
    .map(([id, count]) => ({ rule: ruleById.get(id) as RuleRecord, count }))
    .sort(compareRuleCounts);

  return {
    total: rulesAll.reduce((sum, entry) => sum + entry.count, 0),
    recent,
    thisMonth,
    categoriesAll,
    categoriesRecent,
    rulesAll,
    rulesRecent,
  };
}

export function decorateRules(
  rules: readonly RuleRecord[],
  breaks: readonly BreakRecord[],
  now = new Date(),
): RuleWithMeta[] {
  const counts = new Map<string, { count: number; last: string | null }>();
  const nowValue = now.getTime();
  for (const record of breaks) {
    if (Date.parse(record.occurredAt) > nowValue) continue;
    const current = counts.get(record.ruleId) ?? { count: 0, last: null };
    current.count += 1;
    if (!current.last || record.occurredAt > current.last) {
      current.last = record.occurredAt;
    }
    counts.set(record.ruleId, current);
  }

  return rules.map((rule) => {
    const stats = counts.get(rule.id);
    return {
      ...rule,
      breakCount: stats?.count ?? 0,
      lastBreakAt: stats?.last ?? null,
    };
  });
}

export function sortRulesForList(
  rules: readonly RuleWithMeta[],
): RuleWithMeta[] {
  return [...rules].sort((left, right) => {
    const leftKey = left.lastBreakAt ?? left.createdAt;
    const rightKey = right.lastBreakAt ?? right.createdAt;
    return rightKey.localeCompare(leftKey) || left.title.localeCompare(right.title);
  });
}

export function breaksForRule(
  breaks: readonly BreakRecord[],
  ruleId: string,
): BreakRecord[] {
  return breaks
    .filter((record) => record.ruleId === ruleId)
    .sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        left.id.localeCompare(right.id),
    );
}

export function breaksForDay(
  breaks: readonly BreakRecord[],
  dateKey: string,
): BreakRecord[] {
  return breaks
    .filter((record) => breakDateKey(record) === dateKey)
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.id.localeCompare(right.id),
    );
}

export function categoryCountsForBreaks(
  breaks: readonly BreakRecord[],
  rules: readonly RuleRecord[],
): CategoryCount[] {
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const counts = new Map<CategoryId, number>();
  for (const record of breaks) {
    const rule = ruleById.get(record.ruleId);
    if (rule) incrementCategory(counts, rule.category);
  }
  return CATEGORIES.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
}

export function dayCategoryCounts(
  breaks: readonly BreakRecord[],
  rules: readonly RuleRecord[],
  dateKey: string,
): CategoryCount[] {
  return categoryCountsForBreaks(breaksForDay(breaks, dateKey), rules);
}

export function searchRules<T extends Pick<RuleRecord, "title" | "description">>(
  rules: readonly T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...rules];
  return rules.filter((rule) =>
    `${rule.title}\n${rule.description}`
      .toLocaleLowerCase()
      .includes(normalized),
  );
}
