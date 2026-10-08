import * as z from "zod";

export const runSchema = z.object({
    playbook_id: z.number().int().positive(),
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


export type SignupInput = z.infer<typeof signupSchema>
export type RunInput = z.infer<typeof runSchema>;
export type LoginInput = z.infer<typeof loginSchema>