import { db } from "@/db/db";
import type { AssistantCompletion, ToolCall } from "@/ai/types";
import type { BreakRecord, RuleRecord } from "@/domain/types";

export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}

export function ruleRecord(overrides: Partial<RuleRecord> = {}): RuleRecord {
  const timestamp = "2026-10-01T08:00:00.000Z";
  return {
    id: "rule-1",
    title: "No phone in bed",
    description: "Sleep is the point.",
    category: "mental",
    archived: 0,
    rev: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function breakRecord(overrides: Partial<BreakRecord> = {}): BreakRecord {
  const timestamp = "2026-10-20T13:00:00.000Z";
  return {
    id: "break-1",
    ruleId: "rule-1",
    occurredAt: timestamp,
    situation: "Scrolled for forty minutes.",
    reflection: "",
    source: "manual",
    rev: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function localIso(
  dateKey: string,
  hour = 12,
  minute = 0,
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function toolCall(
  name: string,
  args: unknown,
  id = "call_1",
): ToolCall {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: typeof args === "string" ? args : JSON.stringify(args),
    },
  };
}

export function aiCompletion(
  content: string | null,
  toolCalls: ToolCall[] = [],
): AssistantCompletion {
  return {
    content,
    toolCalls,
    finishReason: toolCalls.length ? "tool_calls" : "stop",
  };
}

export async function seedRule(
  overrides: Partial<RuleRecord> = {},
): Promise<RuleRecord> {
  const record = ruleRecord(overrides);
  await db.rules.put(record);
  return record;
}
