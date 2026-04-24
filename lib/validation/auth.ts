import { z } from "zod";

export const emailField = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email");

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long")
  .refine((s) => /[A-Z]/.test(s), { message: "Include at least one uppercase letter" })
  .refine((s) => /[a-z]/.test(s), { message: "Include at least one lowercase letter" })
  .refine((s) => /[0-9]/.test(s), { message: "Include at least one number" })
  .refine((s) => /[^A-Za-z0-9]/.test(s), { message: "Include at least one symbol" });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
});

/** New + confirm; same `password` rules as signup, must match. */
export const changePasswordFormSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
