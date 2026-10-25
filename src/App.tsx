import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import { DEFAULT_LOCALE, type CategoryId, type Locale } from "@/domain/constants";
import type { BreakRecord, RuleRecord } from "@/domain/types";
import { breaksForRule } from "@/domain/insights";
import { db } from "@/db/db";
import { ensureBootData, setLanguage } from "@/db/repository";
import { useAppHeight } from "@/hooks/useAppHeight";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { installViewportDiagnostics } from "@/lib/viewportDiagnostics";
import { AppShell, AppSplash, type AppTab } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider, useToast } from "@/components/Toast";
import { RulebookScreen } from "@/screens/RulebookScreen";
import { RuleDetailScreen } from "@/screens/RuleDetailScreen";
import { InsightsScreen } from "@/screens/InsightsScreen";
import { RuleFormSheet } from "@/screens/RuleFormSheet";
import { BreakFormSheet } from "@/screens/BreakFormSheet";
import { QuickAddSheet } from "@/screens/QuickAddSheet";
import { AiSheet } from "@/screens/AiSheet";
import { SettingsScreen } from "@/screens/SettingsScreen";

interface RuleFormState {
  mode: "new" | "edit";
  rule?: RuleRecord;
  initialCategory?: CategoryId;
}

interface BreakFormState {
  mode: "create" | "edit";
  rule?: RuleRecord;
  record?: BreakRecord;
}

export default function App() {
  useAppHeight();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState(false);

  useEffect(() => installViewportDiagnostics(), []);
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    void ensureBootData()
      .then((storedLocale) => {
        if (!active) return;
        setLocale(storedLocale);
        setBooted(true);
      })
      .catch(() => {
        if (!active) return;
        setBootError(true);
        setBooted(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
  }, []);

  return (
    <I18nProvider locale={locale} setLocale={changeLocale}>
      <ErrorBoundary>
        <ToastProvider>
          {!booted ? (
            <AppSplash />
          ) : bootError ? (
            <BootError />
          ) : (
            <MainApp />
          )}
        </ToastProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}

function BootError() {
  const { copy } = useI18n();
  return (
    <div className="boot-error">
      <div className="boot-error-panel">
        <span className="seal-mark" aria-hidden="true">
          {copy.app.sealCharacter}
        </span>
        <h1>{copy.app.bootErrorTitle}</h1>
        <p>{copy.app.bootErrorBody}</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => window.location.reload()}
        >
          {copy.app.reload}
        </button>
      </div>
    </div>
  );
}

function MainApp() {
  const { locale, copy, setLocale } = useI18n();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AppTab>("rulebook");
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [ruleFormState, setRuleFormState] = useState<RuleFormState | null>(null);
  const [breakFormState, setBreakFormState] = useState<BreakFormState | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rules = useLiveQuery(() => db.rules.toArray(), []);
  const breaks = useLiveQuery(() => db.breaks.toArray(), []);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const detailRule = useMemo(() => {
    if (!detailRuleId || !rules) return null;
    return rules.find((rule) => rule.id === detailRuleId) ?? null;
  }, [detailRuleId, rules]);

  const detailBreaks = useMemo(() => {
    if (!detailRule || !breaks) return [];
    return breaksForRule(breaks, detailRule.id);
  }, [breaks, detailRule]);

  const openRule = (ruleId: string) => {
    setActiveTab("rulebook");
    setDetailRuleId(ruleId);
  };

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    setDetailRuleId(null);
  };

  const changeLocale = (next: Locale) => {
    setLocale(next);
    void setLanguage(next).catch(() => {
      showToast(copy.errors.generic, "error");
    });
  };

  if (!rules || !breaks) {
    return <AppSplash />;
  }

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenSettings={() => setSettingsOpen(true)}
        onAdd={() => setQuickAddOpen(true)}
        showAdd={activeTab === "rulebook" && !detailRule}
      >
        <div className="screen-stack">
          <section className="app-view" hidden={activeTab !== "rulebook" || Boolean(detailRule)}>
            <RulebookScreen
              rules={rules}
              breaks={breaks}
              onOpenRule={openRule}
              onNewRule={(category) =>
                setRuleFormState({ mode: "new", initialCategory: category })
              }
              onLogSlip={(rule) =>
                setBreakFormState({ mode: "create", rule })
              }
            />
          </section>

          <section className="app-view" hidden={activeTab !== "insights"}>
            <InsightsScreen rules={rules} breaks={breaks} onOpenRule={openRule} />
          </section>

          {detailRule && (
            <section className="app-view app-view--detail">
              <RuleDetailScreen
                rule={detailRule}
                breaks={detailBreaks}
                onBack={() => setDetailRuleId(null)}
                onEditRule={(rule) => setRuleFormState({ mode: "edit", rule })}
                onLogSlip={(rule) => setBreakFormState({ mode: "create", rule })}
                onEditBreak={(rule, record) =>
                  setBreakFormState({ mode: "edit", rule, record })
                }
              />
            </section>
          )}
        </div>
      </AppShell>

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onLogSlip={() => setBreakFormState({ mode: "create" })}
        onNewRule={() => setRuleFormState({ mode: "new" })}
        onOpenAi={() => setAiOpen(true)}
      />

      {ruleFormState && (
        <RuleFormSheet
          open
          mode={ruleFormState.mode}
          rule={ruleFormState.rule}
          initialCategory={ruleFormState.initialCategory}
          onClose={() => setRuleFormState(null)}
          onSaved={(rule, mode) => {
            if (mode === "new") {
              setActiveTab("rulebook");
              setDetailRuleId(rule.id);
            }
          }}
        />
      )}

      {breakFormState && (
        <BreakFormSheet
          open
          mode={breakFormState.mode}
          rules={rules}
          rule={breakFormState.rule}
          record={breakFormState.record}
          onClose={() => setBreakFormState(null)}
          onCreateRule={() => {
            setBreakFormState(null);
            setRuleFormState({ mode: "new" });
          }}
        />
      )}

      <AiSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onOpenSettings={() => {
          setAiOpen(false);
          setSettingsOpen(true);
        }}
      />

      <SettingsScreen
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        locale={locale}
        onLocaleChange={changeLocale}
        onDataImported={() => {
          setDetailRuleId(null);
          setActiveTab("rulebook");
        }}
      />

      {needRefresh && (
        <div className="update-banner" role="status" aria-live="polite">
          <p>{copy.pwa.updateReady}</p>
          <div className="update-actions">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => void updateServiceWorker(true)}
            >
              {copy.pwa.updateAction}
            </button>
            <button
              type="button"
              className="button button--quiet button--small update-later"
              onClick={() => setNeedRefresh(false)}
            >
              {copy.pwa.later}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
