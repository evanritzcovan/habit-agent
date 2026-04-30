import type { AiPlanJson } from "@/schemas/aiPlan.zod";

/** Step IDs belonging to one-time pre-plan setup (not recurring checklist steps). */
export function prePlanStepIdSet(plan: AiPlanJson): Set<string> {
  return new Set(plan.pre_plan_steps.map((p) => p.id));
}

/** Whether `stepId` refers to a pre-plan row in `habit_logs` (`is_setup_step` should be true when logging). */
export function isPrePlanStepId(plan: AiPlanJson, stepId: string): boolean {
  return plan.pre_plan_steps.some((p) => p.id === stepId);
}
