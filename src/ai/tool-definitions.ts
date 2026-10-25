import { CATEGORIES } from "@/domain/constants";

const categoryEnum = [...CATEGORIES];

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_rules",
      description:
        "Search the user's active rules. Always use this before logging a slip so you can reference a real rule id. Returns only id, title, description, and category. This is a read-only tool.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Words to match against rule titles and descriptions. Omit to list the most recently updated rules.",
            maxLength: 120,
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_new_rule",
      description:
        "Prepare a new rule for the user's confirmation. The app shows a confirmation card and saves only if the user approves. Never use this to edit or archive an existing rule. At most one write tool call per response. Include firstBreak only when the user clearly described the slip that should be stored with this new rule.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "A short personal rule, preferably starting with a verb such as 'Don't' in English or an equivalent form in the user's language.",
            minLength: 1,
            maxLength: 80,
          },
          description: {
            type: "string",
            description:
              "Optional context or a note to the future self. Do not invent details.",
            maxLength: 1000,
          },
          category: {
            type: "string",
            enum: categoryEnum,
            description:
              "One of the five fixed categories: health, mental, social, safety, career.",
          },
          firstBreak: {
            type: "object",
            description:
              "Optional first slip to record with this rule. Include only when the user described an actual slip, not a hypothetical one.",
            properties: {
              occurredAt: {
                type: "string",
                description:
                  "Actual occurrence time as a valid ISO 8601 timestamp with timezone (for example 2026-10-25T13:30:00+08:00). Resolve relative dates from the current time in the system prompt.",
              },
              situation: {
                type: "string",
                description:
                  "The user's factual account of what happened, with no invented detail.",
                minLength: 1,
                maxLength: 2000,
              },
              reflection: {
                type: "string",
                description:
                  "Optional reflection from the user. Do not write one on their behalf.",
                maxLength: 2000,
              },
            },
            required: ["occurredAt", "situation"],
            additionalProperties: false,
          },
        },
        required: ["title", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_break",
      description:
        "Prepare a slip against an existing active rule for the user's confirmation. The app saves only after approval. Use search_rules first and pass the exact returned rule id. Never invent a rule id. At most one write tool call per response.",
      parameters: {
        type: "object",
        properties: {
          ruleId: {
            type: "string",
            description: "Exact id returned by search_rules.",
            minLength: 1,
            maxLength: 100,
          },
          occurredAt: {
            type: "string",
            description:
              "Actual occurrence time as a valid ISO 8601 timestamp with timezone (for example 2026-10-25T13:30:00+08:00). Resolve relative dates from the current time in the system prompt.",
          },
          situation: {
            type: "string",
            description:
              "The user's factual account of what happened, with no invented detail.",
            minLength: 1,
            maxLength: 2000,
          },
          reflection: {
            type: "string",
            description:
              "Optional reflection from the user. Do not write one on their behalf.",
            maxLength: 2000,
          },
        },
        required: ["ruleId", "occurredAt", "situation"],
        additionalProperties: false,
      },
    },
  },
] as const;
