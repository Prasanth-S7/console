import * as z from "zod";

export const runSchema = z.object({
    playbookId: z.number().int().positive(),
    arguments: z.record(z.string(), z.string()).optional(),
})