export const LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh-CN";

export const CATEGORIES = [
  "health",
  "mental",
  "social",
  "safety",
  "career",
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export const CATEGORY_SHAPES: Record<
  CategoryId,
  "circle" | "diamond" | "square" | "triangle" | "hexagon"
> = {
  health: "circle",
  mental: "diamond",
  social: "square",
  safety: "triangle",
  career: "hexagon",
};

export const MAX_RULE_TITLE_LENGTH = 80;
export const MAX_RULE_DESCRIPTION_LENGTH = 1000;
export const MAX_BREAK_SITUATION_LENGTH = 2000;
export const MAX_BREAK_REFLECTION_LENGTH = 2000;

/** A future timestamp beyond this tolerance is treated as a typo, not a plan. */
export const FUTURE_BREAK_TOLERANCE_MS = 5 * 60 * 1000;

export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-flash";
export const DEEPSEEK_MAX_TOKENS = 1200;
export const MAX_TOOL_ROUNDS = 4;
export const MAX_CHAT_TURNS = 24;

export const DB_NAME = "dont-dos";
export const APP_SCHEMA_VERSION = 1;
