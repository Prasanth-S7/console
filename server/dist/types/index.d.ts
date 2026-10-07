import * as z from "zod";
export declare const runSchema: z.ZodObject<{
    playbook_id: z.ZodNumber;
    arguments: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const signupSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RunInput = z.infer<typeof runSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
//# sourceMappingURL=index.d.ts.map