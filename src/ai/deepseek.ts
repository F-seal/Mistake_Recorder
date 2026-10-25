import {
  DEEPSEEK_ENDPOINT,
  DEEPSEEK_MAX_TOKENS,
  DEEPSEEK_MODEL,
} from "@/domain/constants";
import type {
  ApiConversationMessage,
  AssistantCompletion,
  DeepSeekErrorCode,
  ToolCall,
} from "./types";
import { TOOL_DEFINITIONS } from "./tool-definitions";

export class DeepSeekError extends Error {
  readonly code: DeepSeekErrorCode;
  readonly status: number | null;

  constructor(
    code: DeepSeekErrorCode,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "DeepSeekError";
    this.code = code;
    this.status = status;
  }
}

interface DeepSeekRequestBody {
  model: string;
  messages: Array<Record<string, unknown>>;
  stream: false;
  thinking: { type: "disabled" };
  max_tokens: number;
  temperature?: number;
  tools?: readonly unknown[];
  tool_choice?: "auto";
}

interface DeepSeekResponseMessage {
  content?: unknown;
  tool_calls?: unknown;
}

interface DeepSeekResponseChoice {
  message?: DeepSeekResponseMessage;
  finish_reason?: unknown;
}

interface DeepSeekResponseBody {
  choices?: unknown;
}

function mapStatus(status: number): DeepSeekErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 402) return "insufficient_balance";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "service_unavailable";
  return "unknown";
}

async function postDeepSeek(
  apiKey: string,
  body: DeepSeekRequestBody,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      throw new DeepSeekError(
        mapStatus(response.status),
        "DeepSeek rejected the request.",
        response.status,
      );
    }

    try {
      return JSON.parse(text.trim()) as unknown;
    } catch {
      throw new DeepSeekError(
        "invalid_response",
        "DeepSeek returned an unreadable response.",
        response.status,
      );
    }
  } catch (error) {
    if (error instanceof DeepSeekError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DeepSeekError("network", "The DeepSeek request timed out.");
    }
    throw new DeepSeekError("network", "Could not reach DeepSeek.");
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function normalizeToolCalls(value: unknown): ToolCall[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new DeepSeekError(
      "invalid_response",
      "DeepSeek returned malformed tool calls.",
    );
  }

  return value.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new DeepSeekError(
        "invalid_response",
        "DeepSeek returned a malformed tool call.",
      );
    }
    const candidate = raw as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.function?.name !== "string"
    ) {
      throw new DeepSeekError(
        "invalid_response",
        "DeepSeek returned an incomplete tool call.",
      );
    }

    const rawArguments = candidate.function.arguments;
    const args =
      typeof rawArguments === "string"
        ? rawArguments
        : rawArguments === undefined
          ? "{}"
          : JSON.stringify(rawArguments);

    return {
      id: candidate.id,
      type: "function" as const,
      function: {
        name: candidate.function.name,
        arguments: args,
      },
    };
  });
}

function parseCompletion(data: unknown): AssistantCompletion {
  const body = data as DeepSeekResponseBody;
  if (!Array.isArray(body.choices) || body.choices.length === 0) {
    throw new DeepSeekError(
      "invalid_response",
      "DeepSeek returned no answer choices.",
    );
  }

  const choice = body.choices[0] as DeepSeekResponseChoice;
  const message = choice?.message;
  if (!message) {
    throw new DeepSeekError(
      "invalid_response",
      "DeepSeek returned no assistant message.",
    );
  }

  const content =
    typeof message.content === "string" && message.content.length > 0
      ? message.content
      : null;
  const toolCalls = normalizeToolCalls(message.tool_calls);
  if (!content && toolCalls.length === 0) {
    throw new DeepSeekError(
      "invalid_response",
      "DeepSeek returned an empty response.",
    );
  }

  return {
    content,
    toolCalls,
    finishReason:
      typeof choice.finish_reason === "string" ? choice.finish_reason : null,
  };
}

export async function requestAssistantCompletion(input: {
  apiKey: string;
  system: string;
  messages: ApiConversationMessage[];
}): Promise<AssistantCompletion> {
  if (!input.apiKey.trim()) {
    throw new DeepSeekError("unauthorized", "A DeepSeek API key is required.");
  }

  const body: DeepSeekRequestBody = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: input.system },
      ...input.messages.map((message) => ({ ...message })),
    ],
    stream: false,
    thinking: { type: "disabled" },
    max_tokens: DEEPSEEK_MAX_TOKENS,
    temperature: 0.2,
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto",
  };

  const data = await postDeepSeek(input.apiKey, body, 60_000);
  return parseCompletion(data);
}

export async function testDeepSeekKey(apiKey: string): Promise<void> {
  if (!apiKey.trim()) {
    throw new DeepSeekError("unauthorized", "A DeepSeek API key is required.");
  }

  const body: DeepSeekRequestBody = {
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "user",
        content: "Reply with the single word OK. Do not call any tools.",
      },
    ],
    stream: false,
    thinking: { type: "disabled" },
    max_tokens: 8,
    temperature: 0,
  };

  const data = await postDeepSeek(apiKey, body, 30_000);
  parseCompletion(data);
}
