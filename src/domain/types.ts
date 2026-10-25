import type { CategoryId, Locale } from "./constants";

export interface BaseRecord {
  id: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleRecord extends BaseRecord {
  title: string;
  description: string;
  category: CategoryId;
  archived: 0 | 1;
}

export interface FirstBreakInput {
  occurredAt: string;
  situation: string;
  reflection: string;
}

export interface RuleInput {
  title: string;
  description: string;
  category: CategoryId;
  firstBreak?: FirstBreakInput;
}

export interface RuleChange {
  title: string;
  description: string;
  category: CategoryId;
}

export interface BreakRecord extends BaseRecord {
  ruleId: string;
  occurredAt: string;
  situation: string;
  reflection: string;
  source: "manual" | "assistant";
}

export interface BreakInput {
  ruleId: string;
  occurredAt: string;
  situation: string;
  reflection: string;
  source: "manual" | "assistant";
}

export interface BreakChange {
  occurredAt: string;
  situation: string;
  reflection: string;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export interface SecretRecord {
  key: "deepseek";
  value: string;
  updatedAt: string;
}

export interface RuleWithMeta extends RuleRecord {
  breakCount: number;
  lastBreakAt: string | null;
}

export interface CategoryCount {
  category: CategoryId;
  count: number;
}

export interface RuleCount {
  rule: RuleRecord;
  count: number;
}

export interface InsightSnapshot {
  total: number;
  recent: number;
  thisMonth: number;
  categoriesAll: CategoryCount[];
  categoriesRecent: CategoryCount[];
  rulesAll: RuleCount[];
  rulesRecent: RuleCount[];
}

export interface BackupData {
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  rules: RuleRecord[];
  breaks: BreakRecord[];
}

export type UiLocale = Locale;
