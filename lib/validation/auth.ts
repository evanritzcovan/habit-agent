import { z } from "zod";

export const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email");

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
