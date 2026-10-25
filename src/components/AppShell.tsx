import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  InsightsIcon,
  PlusIcon,
  RulebookIcon,
  SettingsIcon,
} from "./Icons";

export type AppTab = "rulebook" | "insights";

export function AppShell({
  activeTab,
  onTabChange,
  onOpenSettings,
  onAdd,
  showAdd,
  children,
}: {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenSettings: () => void;
  onAdd: () => void;
  showAdd: boolean;
  children: ReactNode;
}) {
  const { copy } = useI18n();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="seal-mark" aria-hidden="true">
            {copy.app.sealCharacter}
          </span>
          <div className="brand-copy">
            <h1 className="brand-name">{copy.app.name}</h1>
            <p className="brand-tagline">{copy.app.tagline}</p>
          </div>
        </div>
        <button
          type="button"
          className="icon-button settings-button"
          onClick={onOpenSettings}
          aria-label={copy.settings.title}
        >
          <SettingsIcon size={21} />
        </button>
      </header>

      <main className="app-main">{children}</main>

      {showAdd && (
        <button
          type="button"
          className="quick-add"
          onClick={onAdd}
          aria-label={copy.add.title}
        >
          <PlusIcon size={25} strokeWidth={1.8} />
        </button>
      )}

      <nav className="tab-bar" aria-label={copy.app.name}>
        <button
          type="button"
          className={`tab-button${activeTab === "rulebook" ? " tab-button--active" : ""}`}
          aria-current={activeTab === "rulebook" ? "page" : undefined}
          onClick={() => onTabChange("rulebook")}
        >
          <RulebookIcon size={22} />
          <span>{copy.nav.rulebook}</span>
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === "insights" ? " tab-button--active" : ""}`}
          aria-current={activeTab === "insights" ? "page" : undefined}
          onClick={() => onTabChange("insights")}
        >
          <InsightsIcon size={22} />
          <span>{copy.nav.insights}</span>
        </button>
      </nav>
    </div>
  );
}

export function AppSplash() {
  const { copy } = useI18n();
  return (
    <div className="app-splash" aria-busy="true">
      <span className="seal-mark seal-mark--large" aria-hidden="true">
        {copy.app.sealCharacter}
      </span>
      <p>{copy.app.loading}</p>
    </div>
  );
}
