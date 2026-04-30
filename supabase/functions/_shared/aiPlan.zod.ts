/**
 * Duplicate of /schemas/aiPlan.zod.ts for Deno (Edge). Keep in sync with the app + DB contract.
 */
// npm: resolves reliably on Supabase’s remote bundler; align with root `zod` in package.json.
import { z } from "npm:zod@3.25.76";

/** 0 = Sunday, 1 = Monday, …, 6 = Saturday (aligns with `Date.getDay()`) */
export const weekdaySchema = z.number().int().min(0).max(6);

/** One-time setup tasks before recurring steps apply on Today; no frequency. */
export const prePlanStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  /** One sentence: concrete action + why it blocks tracked/today steps until done. */
  description: z.string().min(1).max(500),
});

export const planStepSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500),
    /** Always non-empty after parse: trimmed; if missing/blank, defaults to `title`. */
    description: z.string().max(5000).optional().default(""),
    frequency: z.enum(["daily", "weekly", "monthly"]),
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
    } else if (step.weekdays && step.weekdays.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only weekly steps can include weekdays.",
        path: ["weekdays"],
      });
    }
  })
  .transform((step) => {
    const d = step.description.trim();
    return { ...step, description: d.length > 0 ? d : step.title };
  });

const aiPlanBaseSchema = z
  .object({
    summary: z.string().min(1).max(4000),
    /** Model’s assessment of how demanding the plan is (not a separate user field at habit creation) */
    difficulty: z.enum(["easy", "medium", "hard"]),
    estimated_duration_days: z.number().int().min(1).max(365),
    /** For break habits the AI must populate; see `aiPlanSchemaForHabitType` */
    triggers: z.array(z.string().max(500)).max(20).optional().default([]),
    /** Pre-requisites before recurring steps appear on Today; omit duration when empty. */
    pre_plan_steps: z.array(prePlanStepSchema).max(4).default([]),
    /** Total minutes for all setup tasks combined; required iff pre_plan_steps is non-empty. */
    setup_estimated_minutes: z.number().int().min(5).max(120).optional(),
    steps: z
      .array(planStepSchema)
      .min(1, {
        message:
          'The "steps" array must include at least one recurring checklist item — it cannot be empty []. Add ongoing daily/weekly/monthly steps even when pre_plan_steps has setup tasks.',
      })
      .max(7),
  })
  .superRefine((plan, ctx) => {
    if (plan.pre_plan_steps.length > 0) {
      if (plan.setup_estimated_minutes === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["setup_estimated_minutes"],
          message: "Required when pre_plan_steps is non-empty.",
        });
      }
    } else if (plan.setup_estimated_minutes !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["setup_estimated_minutes"],
        message: "Omit setup_estimated_minutes when pre_plan_steps is empty.",
      });
    }
    const ids = [...plan.pre_plan_steps.map((p) => p.id), ...plan.steps.map((s) => s.id)];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Every id in pre_plan_steps and steps must be unique (no duplicate UUIDs).",
      });
    }
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
export type PrePlanStepJson = z.infer<typeof prePlanStepSchema>;
