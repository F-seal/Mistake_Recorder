import { useI18n } from "@/i18n/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { PlusIcon, RulebookIcon, SparkIcon } from "@/components/Icons";

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onLogSlip: () => void;
  onNewRule: () => void;
  onOpenAi: () => void;
}

export function QuickAddSheet({
  open,
  onClose,
  onLogSlip,
  onNewRule,
  onOpenAi,
}: QuickAddSheetProps) {
  const { copy } = useI18n();

  const options = [
    {
      id: "slip",
      title: copy.add.logSlipTitle,
      body: copy.add.logSlipBody,
      Icon: RulebookIcon,
      action: onLogSlip,
    },
    {
      id: "rule",
      title: copy.add.newRuleTitle,
      body: copy.add.newRuleBody,
      Icon: PlusIcon,
      action: onNewRule,
    },
    {
      id: "ai",
      title: copy.add.aiTitle,
      body: copy.add.aiBody,
      Icon: SparkIcon,
      action: onOpenAi,
    },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={copy.add.title} variant="compact">
      <div className="quick-add-list">
        {options.map(({ id, title, body, Icon, action }) => (
          <button
            key={id}
            type="button"
            className={`quick-add-option quick-add-option--${id}`}
            onClick={() => {
              onClose();
              action();
            }}
          >
            <span className="quick-add-icon" aria-hidden="true">
              <Icon size={21} />
            </span>
            <span className="quick-add-copy">
              <span className="quick-add-title">{title}</span>
              <span className="quick-add-body">{body}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
