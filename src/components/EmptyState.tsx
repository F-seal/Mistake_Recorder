import { useI18n } from "@/i18n/I18nProvider";

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { copy } = useI18n();
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">
        {copy.app.sealCharacter}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-body">{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="button button--primary empty-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
