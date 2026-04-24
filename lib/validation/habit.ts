import { z } from "zod";

export const habitTypeSchema = z.enum(["build", "break"]);

export const createHabitSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  type: habitTypeSchema,
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid start date (YYYY-MM-DD)"),
  context: z
    .string()
    .max(2000, "Context is too long")
    .optional()
    .transform((s) => (s == null || s.trim() === "" ? undefined : s.trim())),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid start date (YYYY-MM-DD)"),
});

export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
