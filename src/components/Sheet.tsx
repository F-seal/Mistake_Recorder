import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { CloseIcon } from "./Icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  variant?: "default" | "tall" | "compact";
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  dismissible = true,
  variant = "default",
  className = "",
}: SheetProps) {
  if (!open) return null;
  return (
    <SheetDialog
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={footer}
      dismissible={dismissible}
      variant={variant}
      className={className}
    >
      {children}
    </SheetDialog>
  );
}

function SheetDialog({
  onClose,
  title,
  subtitle,
  children,
  footer,
  dismissible,
  variant,
  className,
}: Omit<SheetProps, "open">) {
  const { copy } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generatedTitleId = useId();
  const titleId = `sheet-title-${generatedTitleId}`;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissible) onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [dismissible, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`sheet sheet--${variant} ${className}`.trim()}
      aria-labelledby={title ? titleId : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div className="sheet-panel">
        {(title || subtitle || dismissible) && (
          <header className="sheet-header">
            <div className="sheet-heading">
              {title && (
                <h2 id={titleId} className="sheet-title">
                  {title}
                </h2>
              )}
              {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                className="icon-button icon-button--small sheet-close"
                onClick={onClose}
                aria-label={copy.common.close}
              >
                <CloseIcon size={18} />
              </button>
            )}
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
}: ConfirmDialogProps) {
  const { copy } = useI18n();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      variant="compact"
      dismissible={!busy}
      footer={
        <div className="button-row">
          <button
            type="button"
            className="button button--quiet"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              danger ? "button button--danger" : "button button--primary"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? copy.common.saving : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="dialog-copy">{body}</p>
    </Sheet>
  );
}
