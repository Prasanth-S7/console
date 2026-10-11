import * as z from "zod";

export const runSchema = z.object({
    playbook_id: z.coerce.number().int().positive(),
    options: z.record(z.string(), z.unknown()).optional(),
    arguments: z.record(z.string(), z.array(z.string())),
});

export const signupSchema = z.object({
    email: z.string(),
    password: z.string().min(6).max(12)
})

export const loginSchema = z.object({
    email: z.string(),
    password: z.string().min(6).max(12)
})

export const playbookSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
});


export type SignupInput = z.infer<typeof signupSchema>
export type RunInput = z.infer<typeof runSchema>;
export type LoginInput = z.infer<typeof loginSchema>
export type PlaybookInput = z.infer<typeof playbookSchema>