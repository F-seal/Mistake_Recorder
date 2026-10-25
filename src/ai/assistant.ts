import { z } from "zod";
import {
  FUTURE_BREAK_TOLERANCE_MS,
  MAX_BREAK_REFLECTION_LENGTH,
  MAX_BREAK_SITUATION_LENGTH,
  MAX_RULE_DESCRIPTION_LENGTH,
  MAX_RULE_TITLE_LENGTH,
  MAX_TOOL_ROUNDS,
  type Locale,
} from "@/domain/constants";
import { categorySchema, isoDateTimeSchema } from "@/domain/schemas";
import type { BreakInput, RuleInput } from "@/domain/types";
import { getRule, searchActiveRules } from "@/db/repository";
import { isFutureOrInvalidBreak } from "@/lib/dates";
import {
  DeepSeekError,
  requestAssistantCompletion,
} from "./deepseek";
import { buildRecordClerkSystemPrompt } from "./prompts";
import type {
  ApiConversationMessage,
  ApiToolMessage,
  AssistantErrorCode,
  AssistantProgress,
  AssistantTurnResult,
  PendingProposal,
  ProposalOutcome,
  ToolCall,
} from "./types";

const searchRulesArgsSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
  })
  .strict();

const firstBreakArgsSchema = z
  .object({
    occurredAt: isoDateTimeSchema,
    situation: z
      .string()
      .trim()
      .min(1)
      .max(MAX_BREAK_SITUATION_LENGTH),
    reflection: z
      .string()
      .trim()
      .max(MAX_BREAK_REFLECTION_LENGTH)
      .optional(),
  })
  .strict();

const proposeRuleArgsSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_RULE_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .max(MAX_RULE_DESCRIPTION_LENGTH)
      .optional(),
    category: categorySchema,
    firstBreak: firstBreakArgsSchema.optional(),
  })
  .strict();

const proposeBreakArgsSchema = z
  .object({
    ruleId: z.string().trim().min(1).max(100),
    occurredAt: isoDateTimeSchema,
    situation: z
      .string()
      .trim()
      .min(1)
      .max(MAX_BREAK_SITUATION_LENGTH),
    reflection: z
      .string()
      .trim()
      .max(MAX_BREAK_REFLECTION_LENGTH)
      .optional(),
  })
  .strict();

function toolMessage(
  toolCallId: string,
  payload: Record<string, unknown>,
): ApiToolMessage {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(payload),
  };
}

function toolError(toolCallId: string, message: string): ApiToolMessage {
  return toolMessage(toolCallId, { ok: false, error: message });
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function toAssistantErrorCode(error: unknown): AssistantErrorCode {
  return error instanceof DeepSeekError ? error.code : "local_error";
}

function isWriteTool(name: string): boolean {
  return name === "propose_new_rule" || name === "propose_break";
}

async function readToolResult(
  call: ToolCall,
  now: Date,
): Promise<ApiToolMessage> {
  if (call.function.name !== "search_rules") {
    return toolError(call.id, "Unknown tool. Use only the provided tools.");
  }

  const parsed = searchRulesArgsSchema.safeParse(
    parseArguments(call.function.arguments),
  );
  if (!parsed.success) {
    return toolError(call.id, "Invalid search arguments.");
  }

  try {
    const rules = await searchActiveRules(parsed.data.query);
    return toolMessage(call.id, {
      ok: true,
      count: rules.length,
      rules: rules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        description: rule.description,
        category: rule.category,
      })),
      now: now.toISOString(),
    });
  } catch {
    return toolError(call.id, "Rules could not be read. Try again.");
  }
}

interface PreparedProposal {
  proposal: PendingProposal;
}

interface ProposalPreparationError {
  error: string;
}

async function prepareWriteProposal(
  call: ToolCall,
  now: Date,
  conversation: ApiConversationMessage[],
): Promise<PreparedProposal | ProposalPreparationError> {
  const raw = parseArguments(call.function.arguments);
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid JSON arguments." };
  }

  if (call.function.name === "propose_new_rule") {
    const parsed = proposeRuleArgsSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        error:
          "The new rule is incomplete. A title and a valid category are required.",
      };
    }

    const firstBreak = parsed.data.firstBreak
      ? {
          occurredAt: parsed.data.firstBreak.occurredAt,
          situation: parsed.data.firstBreak.situation,
          reflection: parsed.data.firstBreak.reflection ?? "",
        }
      : undefined;

    if (
      firstBreak &&
      isFutureOrInvalidBreak(
        firstBreak.occurredAt,
        FUTURE_BREAK_TOLERANCE_MS,
        now,
      )
    ) {
      return { error: "The slip time is invalid or in the future." };
    }

    const input: RuleInput = {
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      category: parsed.data.category,
      ...(firstBreak ? { firstBreak } : {}),
    };

    return {
      proposal: {
        kind: "rule",
        toolCallId: call.id,
        input,
        category: parsed.data.category,
        conversation,
      },
    };
  }

  if (call.function.name === "propose_break") {
    const parsed = proposeBreakArgsSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        error:
          "The slip is incomplete. A ruleId, a valid time, and what happened are required.",
      };
    }

    if (
      isFutureOrInvalidBreak(
        parsed.data.occurredAt,
        FUTURE_BREAK_TOLERANCE_MS,
        now,
      )
    ) {
      return { error: "The slip time is invalid or in the future." };
    }

    try {
      const rule = await getRule(parsed.data.ruleId);
      if (!rule) {
        return {
          error:
            "That rule does not exist. Search again and use an exact returned id.",
        };
      }
      if (rule.archived === 1) {
        return {
          error:
            "That rule is archived. Choose an active rule or ask the user to restore it.",
        };
      }

      const input: BreakInput = {
        ruleId: rule.id,
        occurredAt: parsed.data.occurredAt,
        situation: parsed.data.situation,
        reflection: parsed.data.reflection ?? "",
        source: "assistant",
      };

      return {
        proposal: {
          kind: "break",
          toolCallId: call.id,
          input,
          rule,
          conversation,
        },
      };
    } catch {
      return { error: "The rule could not be read. Try searching again." };
    }
  }

  return { error: "Unknown write tool." };
}

export async function runAssistantTurn(input: {
  apiKey: string;
  locale: Locale;
  conversation: ApiConversationMessage[];
  now?: Date;
  onProgress?: (progress: AssistantProgress) => void;
  requestCompletion?: typeof requestAssistantCompletion;
}): Promise<AssistantTurnResult> {
  const conversation = [...input.conversation];
  if (!input.apiKey.trim()) {
    return { kind: "error", code: "missing_key", conversation };
  }

  const now = input.now ?? new Date();
  const system = buildRecordClerkSystemPrompt(input.locale, now);
  const request = input.requestCompletion ?? requestAssistantCompletion;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    input.onProgress?.("thinking");

    let completion;
    try {
      completion = await request({
        apiKey: input.apiKey,
        system,
        messages: conversation,
      });
    } catch (error) {
      return {
        kind: "error",
        code: toAssistantErrorCode(error),
        conversation,
      };
    }

    if (completion.toolCalls.length === 0) {
      const text = completion.content ?? "";
      conversation.push({ role: "assistant", content: text });
      return { kind: "reply", text, conversation };
    }

    conversation.push({
      role: "assistant",
      content: completion.content,
      tool_calls: completion.toolCalls,
    });

    const writeCalls = completion.toolCalls.filter((call) =>
      isWriteTool(call.function.name),
    );
    const writeIds = new Set(writeCalls.map((call) => call.id));

    for (const call of completion.toolCalls) {
      if (writeIds.has(call.id)) continue;
      const result = await readToolResult(call, now);
      conversation.push(result);
    }

    if (writeCalls.length > 1) {
      for (const call of writeCalls) {
        conversation.push(
          toolError(
            call.id,
            "Only one write proposal is allowed per response. Propose one record at a time.",
          ),
        );
      }
      return { kind: "error", code: "invalid_action", conversation };
    }

    const writeCall = writeCalls[0];

    if (!writeCall) {
      continue;
    }

    input.onProgress?.("preparing");
    const prepared = await prepareWriteProposal(writeCall, now, conversation);
    if ("error" in prepared) {
      conversation.push(toolError(writeCall.id, prepared.error));
      continue;
    }

    return {
      kind: "proposal",
      text: completion.content,
      proposal: prepared.proposal,
    };
  }

  return { kind: "error", code: "too_many_steps", conversation };
}

export function appendProposalOutcome(
  conversation: ApiConversationMessage[],
  toolCallId: string,
  outcome: ProposalOutcome,
): ApiConversationMessage[] {
  return [
    ...conversation,
    {
      role: "tool",
      tool_call_id: toolCallId,
      content: JSON.stringify(outcome),
    },
  ];
}

export function proposalOutcomeFromReceipt(input: {
  kind: "rule" | "break";
  id: string;
  ruleId?: string;
  title?: string;
}): ProposalOutcome {
  return {
    ok: true,
    kind: input.kind,
    id: input.id,
    ruleId: input.ruleId,
    title: input.title,
  };
}
