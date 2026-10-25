import { z } from "zod";
import {
  CATEGORIES,
  MAX_BREAK_REFLECTION_LENGTH,
  MAX_BREAK_SITUATION_LENGTH,
  MAX_RULE_DESCRIPTION_LENGTH,
  MAX_RULE_TITLE_LENGTH,
} from "./constants";

export const categorySchema = z.enum(CATEGORIES);

export const isoDateTimeSchema = z
  .string()
  .min(10)
  .max(50)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Expected an ISO timestamp",
  );

export const ruleIdSchema = z.string().trim().min(1).max(100);

export const baseStoredFields = {
  id: z.string().trim().min(1).max(100),
  rev: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
} as const;

export const firstBreakInputSchema = z
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
      .max(MAX_BREAK_REFLECTION_LENGTH),
  })
  .strict();

export const ruleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_RULE_TITLE_LENGTH),
    description: z.string().trim().max(MAX_RULE_DESCRIPTION_LENGTH),
    category: categorySchema,
    firstBreak: firstBreakInputSchema.optional(),
  })
  .strict();

export const ruleChangeSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_RULE_TITLE_LENGTH),
    description: z.string().trim().max(MAX_RULE_DESCRIPTION_LENGTH),
    category: categorySchema,
  })
  .strict();

export const breakInputSchema = z
  .object({
    ruleId: ruleIdSchema,
    occurredAt: isoDateTimeSchema,
    situation: z
      .string()
      .trim()
      .min(1)
      .max(MAX_BREAK_SITUATION_LENGTH),
    reflection: z
      .string()
      .trim()
      .max(MAX_BREAK_REFLECTION_LENGTH),
    source: z.enum(["manual", "assistant"]).default("manual"),
  })
  .strict();

export const breakChangeSchema = z
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
      .max(MAX_BREAK_REFLECTION_LENGTH),
  })
  .strict();

export const ruleRecordSchema = z
  .object({
    ...baseStoredFields,
    title: z.string().trim().min(1).max(MAX_RULE_TITLE_LENGTH),
    description: z.string().trim().max(MAX_RULE_DESCRIPTION_LENGTH),
    category: categorySchema,
    archived: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();

export const breakRecordSchema = z
  .object({
    ...baseStoredFields,
    ruleId: ruleIdSchema,
    occurredAt: isoDateTimeSchema,
    situation: z
      .string()
      .trim()
      .min(1)
      .max(MAX_BREAK_SITUATION_LENGTH),
    reflection: z
      .string()
      .trim()
      .max(MAX_BREAK_REFLECTION_LENGTH),
    source: z.enum(["manual", "assistant"]),
  })
  .strict();

export const secretRecordSchema = z
  .object({
    key: z.literal("deepseek"),
    value: z.string().trim().min(1),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const backupSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: isoDateTimeSchema,
    appVersion: z.string().min(1).max(40),
    rules: z.array(ruleRecordSchema).max(5000),
    breaks: z.array(breakRecordSchema).max(50000),
  })
  .strict();

export type ParsedRuleInput = z.infer<typeof ruleInputSchema>;
export type ParsedBreakInput = z.infer<typeof breakInputSchema>;
