import type { CategoryId } from "@/domain/constants";
import type { BreakInput, RuleInput, RuleRecord } from "@/domain/types";

export type DeepSeekErrorCode =
  | "unauthorized"
  | "insufficient_balance"
  | "invalid_request"
  | "rate_limited"
  | "service_unavailable"
  | "network"
  | "invalid_response"
  | "unknown";

export type AssistantErrorCode =
  | DeepSeekErrorCode
  | "missing_key"
  | "too_many_steps"
  | "local_error"
  | "invalid_action";

export type AssistantProgress = "thinking" | "preparing";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ApiUserMessage {
  role: "user";
  content: string;
}

export interface ApiAssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface ApiToolMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

export type ApiConversationMessage =
  | ApiUserMessage
  | ApiAssistantMessage
  | ApiToolMessage;

export interface AssistantCompletion {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

interface PendingProposalBase {
  toolCallId: string;
  conversation: ApiConversationMessage[];
}

export interface PendingRuleProposal extends PendingProposalBase {
  kind: "rule";
  input: RuleInput;
  category: CategoryId;
}

export interface PendingBreakProposal extends PendingProposalBase {
  kind: "break";
  input: BreakInput;
  rule: RuleRecord;
}

export type PendingProposal = PendingRuleProposal | PendingBreakProposal;

export type AssistantTurnResult =
  | {
      kind: "reply";
      text: string;
      conversation: ApiConversationMessage[];
    }
  | {
      kind: "proposal";
      text: string | null;
      proposal: PendingProposal;
    }
  | {
      kind: "error";
      code: AssistantErrorCode;
      conversation: ApiConversationMessage[];
    };

export interface ProposalOutcome {
  ok: boolean;
  declined?: boolean;
  kind?: "rule" | "break";
  id?: string;
  ruleId?: string;
  title?: string;
  error?: string;
}
