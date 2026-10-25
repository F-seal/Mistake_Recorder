import type { Locale } from "@/domain/constants";
import { en, type Dictionary } from "./en";
import { zhCN } from "./zh-CN";

const dictionaries: Record<Locale, Dictionary> = {
  en,
  "zh-CN": zhCN,
};

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
