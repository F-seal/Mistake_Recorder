import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import type { BreakRecord } from "@/domain/types";
import {
  createBreak,
  createRule,
  getDeepSeekKey,
  RepositoryError,
} from "@/db/repository";
import {
  appendProposalOutcome,
  runAssistantTurn,
} from "@/ai/assistant";
import type {
  ApiConversationMessage,
  AssistantProgress,
  PendingProposal,
} from "@/ai/types";
import { useI18n } from "@/i18n/I18nProvider";
import { createId } from "@/lib/id";
import { formatDateTime } from "@/lib/dates";
import { CategoryBadge } from "@/components/CategoryMark";
import { Sheet } from "@/components/Sheet";
import {
  AlertIcon,
  CheckIcon,
  KeyIcon,
  SendIcon,
  SparkIcon,
} from "@/components/Icons";

interface AiSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface UiMessage {
  id: string;
  role: "user" | "assistant" | "error" | "receipt";
  text: string;
  tone?: "success" | "neutral";
}

type KeyState = "loading" | "missing" | "ready";

function assistantMessage(text: string): UiMessage {
  return { id: createId(), role: "assistant", text };
}

function repositoryErrorMessage(
  error: unknown,
  kind: "rule" | "break",
  copy: ReturnType<typeof useI18n>["copy"],
): string {
  if (!(error instanceof RepositoryError)) return copy.errors.saveFailed;
  if (error.code === "stale") return copy.errors.stale;
  if (error.code === "future_time") return copy.breakForm.futureDate;
  if (error.code === "archived") return copy.errors.ruleArchived;
  if (error.code === "not_found") {
    return kind === "break"
      ? copy.errors.ruleMissingForBreak
      : copy.errors.recordNotFound;
  }
  if (error.code === "invalid_input") return copy.errors.saveFailed;
  return copy.errors.saveFailed;
}

export function AiSheet({ open, onClose, onOpenSettings }: AiSheetProps) {
  const { locale, copy } = useI18n();
  const keyRef = useRef<string | null>(null);
  const sessionRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const [keyState, setKeyState] = useState<KeyState>("loading");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversation, setConversation] = useState<ApiConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<AssistantProgress | null>(null);
  const [pending, setPending] = useState<PendingProposal | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    sessionRef.current += 1;
    setKeyState("loading");
    setMessages([assistantMessage(copy.ai.greeting)]);
    setConversation([]);
    setInput("");
    setBusy(false);
    setApplying(false);
    setProgress(null);
    setPending(null);
    keyRef.current = null;

    void getDeepSeekKey()
      .then((key) => {
        if (!active) return;
        keyRef.current = key;
        setKeyState(key ? "ready" : "missing");
      })
      .catch(() => {
        if (!active) return;
        keyRef.current = null;
        setKeyState("missing");
      });

    return () => {
      active = false;
      sessionRef.current += 1;
    };
  }, [open, copy.ai.greeting]);

  useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [open, messages, pending, busy]);

  useEffect(() => {
    if (pending && !applying) {
      confirmRef.current?.focus();
    }
  }, [pending, applying]);

  function pushMessage(message: UiMessage) {
    setMessages((current) => [...current, message]);
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || busy || applying || pending || keyState !== "ready") return;
    if (!keyRef.current) {
      setKeyState("missing");
      return;
    }

    const session = sessionRef.current;
    const nextConversation: ApiConversationMessage[] = [
      ...conversation,
      { role: "user", content: text },
    ];
    setConversation(nextConversation);
    pushMessage({ id: createId(), role: "user", text });
    setInput("");
    setBusy(true);
    setProgress("thinking");

    try {
      const result = await runAssistantTurn({
        apiKey: keyRef.current,
        locale,
        conversation: nextConversation,
        onProgress: setProgress,
      });

      if (sessionRef.current !== session) return;

      if (result.kind === "reply") {
        setConversation(result.conversation);
        if (result.text.trim()) {
          pushMessage(assistantMessage(result.text.trim()));
        }
      } else if (result.kind === "proposal") {
        setConversation(result.proposal.conversation);
        if (result.text?.trim()) {
          pushMessage(assistantMessage(result.text.trim()));
        }
        setPending(result.proposal);
      } else {
        setConversation(result.conversation);
        pushMessage({
          id: createId(),
          role: "error",
          text: copy.ai.errors[result.code] ?? copy.ai.errors.unknown,
        });
      }
    } catch {
      if (sessionRef.current === session) {
        pushMessage({
          id: createId(),
          role: "error",
          text: copy.ai.errors.local_error,
        });
      }
    } finally {
      if (sessionRef.current === session) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  async function confirmProposal() {
    if (!pending || applying) return;
    setApplying(true);
    try {
      if (pending.kind === "rule") {
        const created = await createRule(pending.input, { source: "assistant" });
        setConversation(
          appendProposalOutcome(pending.conversation, pending.toolCallId, {
            ok: true,
            kind: "rule",
            id: created.rule.id,
            title: created.rule.title,
          }),
        );
        pushMessage({
          id: createId(),
          role: "receipt",
          tone: "success",
          text: copy.ai.receiptRule(created.rule.title),
        });
      } else {
        const saved: BreakRecord = await createBreak(pending.input);
        setConversation(
          appendProposalOutcome(pending.conversation, pending.toolCallId, {
            ok: true,
            kind: "break",
            id: saved.id,
            ruleId: pending.rule.id,
            title: pending.rule.title,
          }),
        );
        pushMessage({
          id: createId(),
          role: "receipt",
          tone: "success",
          text: copy.ai.receiptSlip(pending.rule.title),
        });
      }
      setPending(null);
    } catch (error) {
      const kind = pending.kind;
      setConversation(
        appendProposalOutcome(pending.conversation, pending.toolCallId, {
          ok: false,
          error: "save_failed",
        }),
      );
      pushMessage({
        id: createId(),
        role: "error",
        text: repositoryErrorMessage(error, kind, copy),
      });
      setPending(null);
    } finally {
      setApplying(false);
    }
  }

  function cancelProposal() {
    if (!pending || applying) return;
    setConversation(
      appendProposalOutcome(pending.conversation, pending.toolCallId, {
        ok: false,
        declined: true,
      }),
    );
    pushMessage({
      id: createId(),
      role: "receipt",
      tone: "neutral",
      text: copy.ai.declined,
    });
    setPending(null);
  }

  const progressText =
    progress === "preparing" ? copy.ai.preparing : copy.ai.thinking;
  const canSend =
    keyState === "ready" &&
    Boolean(input.trim()) &&
    !busy &&
    !applying &&
    !pending;
  const showExamples =
    keyState === "ready" &&
    conversation.length === 0 &&
    messages.length === 1 &&
    !busy;

  const composer =
    keyState === "ready" ? (
      <div className="ai-composer-wrap">
        {busy && (
          <p className="ai-progress" role="status" aria-live="polite">
            <span className="ai-progress-dot" aria-hidden="true" />
            {progressText}
          </p>
        )}
        {pending && <p className="composer-note">{copy.ai.unsavedProposal}</p>}
        <form className="ai-composer" onSubmit={submit}>
          <textarea
            ref={composerRef}
            className="ai-input"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={copy.ai.placeholder}
            maxLength={2000}
            disabled={busy || applying || Boolean(pending)}
            enterKeyHint="enter"
            aria-label={copy.ai.placeholder}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!canSend}
            aria-label={copy.ai.send}
          >
            <SendIcon size={19} />
          </button>
        </form>
      </div>
    ) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={copy.ai.title}
      subtitle={copy.ai.subtitle}
      variant="tall"
      dismissible={!pending && !applying}
      footer={composer}
      className="ai-sheet"
    >
      <div className="ai-meta-row">
        <span className="ai-meta-pill">
          <SparkIcon size={13} />
          {copy.ai.ephemeral}
        </span>
      </div>

      <div className="ai-messages">
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="ai-message ai-message--user">
                <p>{message.text}</p>
              </div>
            );
          }
          if (message.role === "error") {
            return (
              <div key={message.id} className="ai-error" role="alert">
                <span className="ai-error-icon" aria-hidden="true">
                  <AlertIcon size={18} />
                </span>
                <div>
                  <p className="ai-error-title">{copy.ai.errorTitle}</p>
                  <p>{message.text}</p>
                </div>
              </div>
            );
          }
          if (message.role === "receipt") {
            return (
              <div
                key={message.id}
                className={`ai-receipt${
                  message.tone === "success" ? " ai-receipt--success" : ""
                }`}
                role="status"
              >
                {message.tone === "success" && (
                  <span aria-hidden="true">
                    <CheckIcon size={15} />
                  </span>
                )}
                <span>{message.text}</span>
              </div>
            );
          }
          return (
            <div key={message.id} className="ai-message ai-message--assistant">
              <p>{message.text}</p>
            </div>
          );
        })}

        {keyState === "loading" && (
          <p className="ai-key-loading">{copy.common.loading}</p>
        )}

        {keyState === "missing" && (
          <div className="ai-key-card">
            <span className="ai-key-icon" aria-hidden="true">
              <KeyIcon size={22} />
            </span>
            <h3>{copy.ai.keyMissingTitle}</h3>
            <p>{copy.ai.keyMissingBody}</p>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={onOpenSettings}
            >
              {copy.common.openSettings}
            </button>
          </div>
        )}

        {showExamples && (
          <div className="ai-examples">
            <p className="ai-examples-label">{copy.ai.useExample}</p>
            {copy.ai.examples.map((example) => (
              <button
                key={example}
                type="button"
                className="ai-example"
                onClick={() => {
                  setInput(example);
                  composerRef.current?.focus();
                }}
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {keyState === "ready" && (
          <p className="ai-fineprint">{copy.ai.note}</p>
        )}

        {pending && (
          <ProposalCard
            proposal={pending}
            applying={applying}
            confirmRef={confirmRef}
            onConfirm={() => void confirmProposal()}
            onCancel={cancelProposal}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </Sheet>
  );
}

function ProposalCard({
  proposal,
  applying,
  confirmRef,
  onConfirm,
  onCancel,
}: {
  proposal: PendingProposal;
  applying: boolean;
  confirmRef: RefObject<HTMLButtonElement>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { locale, copy } = useI18n();
  const category =
    proposal.kind === "rule" ? proposal.input.category : proposal.rule.category;

  return (
    <section className="proposal-card" data-category={category}>
      <div className="proposal-heading-row">
        <span className="proposal-kicker">
          {proposal.kind === "rule"
            ? copy.ai.proposalRuleHeading
            : copy.ai.proposalSlipHeading}
        </span>
        <CategoryBadge category={category} />
      </div>

      {proposal.kind === "rule" ? (
        <>
          <h3 className="proposal-title">{proposal.input.title}</h3>
          {proposal.input.description && (
            <p className="proposal-description">{proposal.input.description}</p>
          )}
          {proposal.input.firstBreak && (
            <div className="proposal-subrecord">
              <p className="proposal-subheading">{copy.breakForm.detailsTitle}</p>
              <p className="proposal-time">
                {formatDateTime(
                  proposal.input.firstBreak.occurredAt,
                  locale,
                  true,
                )}
              </p>
              <p className="proposal-situation">
                {proposal.input.firstBreak.situation}
              </p>
              {proposal.input.firstBreak.reflection && (
                <p className="proposal-reflection">
                  {proposal.input.firstBreak.reflection}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <h3 className="proposal-title">{proposal.rule.title}</h3>
          <div className="proposal-fields">
            <p className="proposal-time">
              {formatDateTime(proposal.input.occurredAt, locale, true)}
            </p>
            <p className="proposal-situation">{proposal.input.situation}</p>
            {proposal.input.reflection && (
              <p className="proposal-reflection">{proposal.input.reflection}</p>
            )}
          </div>
        </>
      )}

      <div className="proposal-actions">
        <button
          type="button"
          className="button button--quiet"
          onClick={onCancel}
          disabled={applying}
        >
          {copy.ai.cancelProposal}
        </button>
        <button
          ref={confirmRef}
          type="button"
          className="button button--primary"
          onClick={onConfirm}
          disabled={applying}
        >
          {applying
            ? copy.common.saving
            : proposal.kind === "rule"
              ? copy.ai.confirmRule
              : copy.ai.confirmSlip}
        </button>
      </div>
    </section>
  );
}
