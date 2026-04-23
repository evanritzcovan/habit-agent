/**
 * Shared contract for `habit_plans.ai_plan` JSON and AI Edge Function output.
 * Duplicate into supabase/functions/.../ if needed for deploy isolation; keep in sync.
 */
import { z } from "zod";

/** 0 = Sunday, 1 = Monday, …, 6 = Saturday (aligns with `Date.getDay()`) */
export const weekdaySchema = z.number().int().min(0).max(6);

export const planStepSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional().default(""),
    frequency: z.enum(["daily", "weekly"]),
    /** Required when frequency is weekly: which weekdays the step applies */
    weekdays: z.array(weekdaySchema).max(7).optional(),
  })
  .superRefine((step, ctx) => {
    if (step.frequency === "weekly") {
      if (!step.weekdays || step.weekdays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weekly steps must include at least one weekday (0–6).",
          path: ["weekdays"],
        });
      } else {
        const unique = new Set(step.weekdays);
        if (unique.size !== step.weekdays.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Weekdays must be unique.",
            path: ["weekdays"],
          });
        }
      }
    }
  });

const aiPlanBaseSchema = z
  .object({
    summary: z.string().min(1).max(4000),
    /** Model’s assessment of how demanding the plan is (not a separate user field at habit creation) */
    difficulty: z.enum(["easy", "medium", "hard"]),
    estimated_duration_days: z.number().int().min(1).max(365),
    /** For break habits the AI must populate; see `aiPlanSchemaForHabitType` */
    triggers: z.array(z.string().max(500)).max(20).optional().default([]),
    steps: z.array(planStepSchema).min(1).max(7),
  });

export const aiPlanRootSchema = aiPlanBaseSchema;

/** Zod parser that enforces trigger rules for break vs build habits. */
export function aiPlanSchemaForHabitType(habitType: "build" | "break") {
  return aiPlanBaseSchema.superRefine((plan, ctx) => {
    if (habitType === "break" && (!plan.triggers || plan.triggers.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["triggers"],
        message: "Break habits require at least one trigger.",
      });
    }
  });
}

export function parseAiPlanForHabit(
  raw: unknown,
  habitType: "build" | "break"
): z.infer<typeof aiPlanRootSchema> {
  return aiPlanSchemaForHabitType(habitType).parse(raw);
}

export type AiPlanJson = z.infer<typeof aiPlanRootSchema>;
export type PlanStepJson = z.infer<typeof planStepSchema>;
