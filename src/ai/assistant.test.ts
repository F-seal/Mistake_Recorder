import { beforeEach, describe, expect, it } from "vitest";
import {
  appendProposalOutcome,
  runAssistantTurn,
} from "./assistant";
import {
  DeepSeekError,
  requestAssistantCompletion,
} from "./deepseek";
import type {
  AssistantCompletion,
  ApiConversationMessage,
} from "./types";
import { buildRecordClerkSystemPrompt } from "./prompts";
import { createRule, setRuleArchived } from "@/db/repository";
import { db } from "@/db/db";
import { resetDatabase } from "@/test/database";
import { aiCompletion, toolCall } from "@/test/database";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const PAST = "2026-10-24T22:15:00.000Z";
const FUTURE = "2026-10-26T22:15:00.000Z";

type RequestFn = typeof requestAssistantCompletion;

function requestSequence(
  sequence: AssistantCompletion[],
): RequestFn {
  return async () => {
    const next = sequence.shift();
    if (!next) throw new Error("No completion left in test sequence");
    return next;
  };
}

beforeEach(async () => {
  await resetDatabase();
});

async function makeRule(title = "No phone in bed") {
  const { rule } = await createRule(
    {
      title,
      description: "Sleep first.",
      category: "mental",
    },
    { now: NOW },
  );
  return rule;
}

describe("record clerk assistant", () => {
  it("returns a plain reply and keeps the conversation", async () => {
    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "zh-CN",
      conversation: [{ role: "user", content: "你好" }],
      now: NOW,
      requestCompletion: requestSequence([aiCompletion("你好，我可以帮你记录。")]),
    });

    expect(result.kind).toBe("reply");
    if (result.kind !== "reply") return;
    expect(result.text).toContain("记录");
    expect(result.conversation.at(-1)).toEqual({
      role: "assistant",
      content: "你好，我可以帮你记录。",
    });
  });

  it("executes search_rules before answering and returns tool data to the model", async () => {
    const rule = await makeRule();
    const calls: Array<Parameters<RequestFn>[0]> = [];
    const sequence = [
      aiCompletion(null, [
        toolCall("search_rules", { query: "phone" }, "search-1"),
      ]),
      aiCompletion("找到了「No phone in bed」。"),
    ];
    const request: RequestFn = async (input) => {
      calls.push(input);
      const next = sequence.shift();
      if (!next) throw new Error("No completion");
      return next;
    };

    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "en",
      conversation: [],
      now: NOW,
      requestCompletion: request,
    });

    expect(result.kind).toBe("reply");
    expect(calls).toHaveLength(2);
    const toolMessage = calls[1]?.messages.find((message) => message.role === "tool");
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.content).toContain(rule.id);
    expect(toolMessage?.content).toContain("No phone in bed");
  });

  it("pauses with a break proposal and does not write it", async () => {
    const rule = await makeRule();
    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "en",
      conversation: [],
      now: NOW,
      requestCompletion: requestSequence([
        aiCompletion(null, [
          toolCall(
            "propose_break",
            {
              ruleId: rule.id,
              occurredAt: PAST,
              situation: "Scrolled for forty minutes.",
              reflection: "Charger moved.",
            },
            "write-1",
          ),
        ]),
      ]),
    });

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") return;
    expect(result.proposal.kind).toBe("break");
    if (result.proposal.kind !== "break") return;
    expect(result.proposal.input).toMatchObject({
      ruleId: rule.id,
      situation: "Scrolled for forty minutes.",
      source: "assistant",
    });
    expect(result.proposal.rule.title).toBe("No phone in bed");
    expect(await db.breaks.count()).toBe(0);
  });

  it("pauses with a new-rule proposal including an optional first slip", async () => {
    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "zh-CN",
      conversation: [],
      now: NOW,
      requestCompletion: requestSequence([
        aiCompletion(null, [
          toolCall(
            "propose_new_rule",
            {
              title: "不在床上看手机",
              category: "mental",
              firstBreak: {
                occurredAt: PAST,
                situation: "又刷了半小时。",
              },
            },
            "write-1",
          ),
        ]),
      ]),
    });

    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal" || result.proposal.kind !== "rule") return;
    expect(result.proposal.input.title).toBe("不在床上看手机");
    expect(result.proposal.input.description).toBe("");
    expect(result.proposal.input.firstBreak?.reflection).toBe("");
    expect(await db.rules.count()).toBe(0);
  });

  it("turns invalid write arguments into a tool error and lets the model recover", async () => {
    const rule = await makeRule();
    const calls: Array<Parameters<RequestFn>[0]> = [];
    const sequence = [
      aiCompletion(null, [
        toolCall(
          "propose_break",
          { ruleId: rule.id, occurredAt: PAST },
          "write-1",
        ),
      ]),
      aiCompletion("请补充当时发生了什么。"),
    ];
    const request: RequestFn = async (input) => {
      calls.push(input);
      const next = sequence.shift();
      if (!next) throw new Error("No completion");
      return next;
    };

    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "zh-CN",
      conversation: [],
      now: NOW,
      requestCompletion: request,
    });

    expect(result.kind).toBe("reply");
    const toolMessage = calls[1]?.messages.find((message) => message.role === "tool");
    expect(toolMessage?.content).toContain('"ok":false');
    expect(toolMessage?.content).toContain("incomplete");
    expect(await db.breaks.count()).toBe(0);
  });

  it("rejects a future slip and recovers with a reply", async () => {
    const rule = await makeRule();
    const calls: Array<Parameters<RequestFn>[0]> = [];
    const sequence = [
      aiCompletion(null, [
        toolCall(
          "propose_break",
          {
            ruleId: rule.id,
            occurredAt: FUTURE,
            situation: "A future slip.",
          },
          "write-1",
        ),
      ]),
      aiCompletion("时间不能在未来。"),
    ];
    const request: RequestFn = async (input) => {
      calls.push(input);
      const next = sequence.shift();
      if (!next) throw new Error("No completion");
      return next;
    };

    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "en",
      conversation: [],
      now: NOW,
      requestCompletion: request,
    });

    expect(result.kind).toBe("reply");
    const toolMessage = calls[1]?.messages.find((message) => message.role === "tool");
    expect(toolMessage?.content).toContain("future");
    expect(await db.breaks.count()).toBe(0);
  });

  it("reports archived rules as invalid proposals", async () => {
    const rule = await makeRule();
    await setRuleArchived(rule.id, rule.rev, true);
    const calls: Array<Parameters<RequestFn>[0]> = [];
    const sequence = [
      aiCompletion(null, [
        toolCall(
          "propose_break",
          {
            ruleId: rule.id,
            occurredAt: PAST,
            situation: "Archived rule.",
          },
          "write-1",
        ),
      ]),
      aiCompletion("这条规矩已归档。"),
    ];
    const request: RequestFn = async (input) => {
      calls.push(input);
      const next = sequence.shift();
      if (!next) throw new Error("No completion");
      return next;
    };

    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "zh-CN",
      conversation: [],
      now: NOW,
      requestCompletion: request,
    });

    expect(result.kind).toBe("reply");
    const toolMessage = calls[1]?.messages.find((message) => message.role === "tool");
    expect(toolMessage?.content).toContain("archived");
  });

  it("rejects multiple write proposals without writing anything", async () => {
    const rule = await makeRule();
    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "en",
      conversation: [],
      now: NOW,
      requestCompletion: requestSequence([
        aiCompletion(null, [
          toolCall(
            "propose_break",
            { ruleId: rule.id, occurredAt: PAST, situation: "One." },
            "write-1",
          ),
          toolCall(
            "propose_break",
            { ruleId: rule.id, occurredAt: PAST, situation: "Two." },
            "write-2",
          ),
        ]),
      ]),
    });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.code).toBe("invalid_action");
    expect(await db.breaks.count()).toBe(0);
    const toolResults = result.conversation.filter((message) => message.role === "tool");
    expect(toolResults).toHaveLength(2);
  });

  it("surfaces provider errors without corrupting the conversation", async () => {
    const originalConversation: ApiConversationMessage[] = [
      { role: "user", content: "Hello" },
    ];
    const request: RequestFn = async () => {
      throw new DeepSeekError("rate_limited", "Slow down");
    };

    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "en",
      conversation: originalConversation,
      now: NOW,
      requestCompletion: request,
    });

    expect(result).toEqual({
      kind: "error",
      code: "rate_limited",
      conversation: originalConversation,
    });
  });

  it("reports a missing key before making a request", async () => {
    const result = await runAssistantTurn({
      apiKey: "  ",
      locale: "en",
      conversation: [],
      now: NOW,
      requestCompletion: async () => {
        throw new Error("should not be called");
      },
    });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.code).toBe("missing_key");
  });

  it("bounds repeated tool rounds", async () => {
    let callNumber = 0;
    const request: RequestFn = async () => {
      callNumber += 1;
      return aiCompletion(null, [
        toolCall("search_rules", { query: "" }, `search-${callNumber}`),
      ]);
    };

    const result = await runAssistantTurn({
      apiKey: "sk-test",
      locale: "en",
      conversation: [],
      now: NOW,
      requestCompletion: request,
    });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.code).toBe("too_many_steps");
    expect(callNumber).toBe(4);
  });

  it("appends declined and confirmed tool outcomes", () => {
    const conversation: ApiConversationMessage[] = [];
    const declined = appendProposalOutcome(conversation, "write-1", {
      ok: false,
      declined: true,
    });
    expect(declined).toHaveLength(1);
    expect(declined[0]).toMatchObject({
      role: "tool",
      tool_call_id: "write-1",
    });
    expect(declined[0]?.content).toContain("declined");
  });

  it("tells the model the fixed categories, current time, and add-only role", () => {
    const prompt = buildRecordClerkSystemPrompt("zh-CN", NOW);
    expect(prompt).toContain("Simplified Chinese");
    expect(prompt).toContain("health");
    expect(prompt).toContain("career");
    expect(prompt).toContain("cannot edit");
    expect(prompt).toContain("Current instant");
    expect(prompt).toContain("at most one write tool call");
  });
});
