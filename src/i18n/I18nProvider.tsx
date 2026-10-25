import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { Locale } from "@/domain/constants";
import { dictionaryFor, type Dictionary } from "./index";

interface I18nContextValue {
  locale: Locale;
  copy: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      copy: dictionaryFor(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = value.copy.app.name;
  }, [locale, value.copy.app.name]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
