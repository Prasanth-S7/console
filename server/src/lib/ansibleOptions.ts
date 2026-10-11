import * as z from "zod";

export type OptionType =
    | "path"      // absolute file path on the Ansible server
    | "string"    // free text
    | "list"      // comma-separated list, sent as an array
    | "boolean"   // flag with no value
    | "number"    // integer
    | "count";    // repeated short flag, e.g. -vvv

export type OptionValue = string | string[] | number | boolean;

export interface OptionDef {
    key: string;
    flag: string;
    label: string;
    description: string;
    type: OptionType;
    placeholder?: string;
    pattern?: string;
    min?: number;
    max?: number;
}

/**
 * Only options listed here can be used. Interactive options (-k, -K,
 * --ask-vault-pass) are left out because the worker has no terminal.
 * --ssh-common-args and --ssh-extra-args are left out because they can
 * run arbitrary commands (e.g. ProxyCommand).
 */
export const OPTION_DEFS: OptionDef[] = [
    {
        key: "inventory",
        flag: "--inventory",
        label: "Inventory file",
        description: "Inventory file on the Ansible server.",
        type: "path",
        placeholder: "/etc/ansible/inventory.ini",
    },
    {
        key: "limit",
        flag: "--limit",
        label: "Limit hosts",
        description: "Restrict the run to these hosts or groups, e.g. web01 or all:!web03.",
        type: "string",
        placeholder: "web01",
    },
    {
        key: "tags",
        flag: "--tags",
        label: "Tags",
        description: "Run only tasks with these tags. Separate with commas.",
        type: "list",
        placeholder: "deploy, configure",
    },
    {
        key: "skip_tags",
        flag: "--skip-tags",
        label: "Skip tags",
        description: "Skip tasks with these tags. Separate with commas.",
        type: "list",
        placeholder: "cleanup, debug",
    },
    {
        key: "start_at_task",
        flag: "--start-at-task",
        label: "Start at task",
        description: "Start the playbook at the task with this name.",
        type: "string",
    },
    {
        key: "check",
        flag: "--check",
        label: "Dry run",
        description: "Simulate the run without making changes.",
        type: "boolean",
    },
    {
        key: "diff",
        flag: "--diff",
        label: "Show diff",
        description: "Show file differences. Usually combined with dry run.",
        type: "boolean",
    },
    {
        key: "user",
        flag: "--user",
        label: "SSH user",
        description: "User to connect to the managed hosts as.",
        type: "string",
        placeholder: "ansibleuser",
        pattern: "^[A-Za-z_][A-Za-z0-9_.-]*$",
    },
    {
        key: "private_key",
        flag: "--private-key",
        label: "Private key file",
        description: "SSH private key on the Ansible server.",
        type: "path",
        placeholder: "/home/ansible/.ssh/id_ed25519",
    },
    {
        key: "become",
        flag: "--become",
        label: "Use sudo",
        description: "Run tasks with privilege escalation.",
        type: "boolean",
    },
    {
        key: "become_user",
        flag: "--become-user",
        label: "Become user",
        description: "User to switch to when escalating. Default is root.",
        type: "string",
        placeholder: "root",
        pattern: "^[A-Za-z_][A-Za-z0-9_.-]*$",
    },
    {
        key: "vault_password_file",
        flag: "--vault-password-file",
        label: "Vault password file",
        description: "File on the Ansible server containing the Vault password.",
        type: "path",
        placeholder: "/home/ansible/.vault_pass",
    },
    {
        key: "forks",
        flag: "--forks",
        label: "Forks",
        description: "Number of hosts to run in parallel. Default is 5.",
        type: "number",
        placeholder: "5",
        min: 1,
        max: 50,
    },
    {
        key: "verbosity",
        flag: "-v",
        label: "Verbosity",
        description: "Output detail from 1 (-v) to 4 (-vvvv).",
        type: "count",
        placeholder: "1",
        min: 1,
        max: 4,
    },
];

export const DEF_MAP = new Map(OPTION_DEFS.map((def) => [def.key, def]));

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

function textSchema(def: OptionDef) {
    const base = z
        .string()
        .trim()
        .min(1, "a value is required")
        .max(500, "value is too long")
        .refine((v) => !v.startsWith("-"), "must not start with '-'")
        .refine((v) => !/[\r\n\0]/.test(v), "must not contain line breaks");

    if (def.pattern) {
        const re = new RegExp(def.pattern);
        return base.refine((v) => re.test(v), "invalid format");
    }

    return base;
}

function schemaFor(def: OptionDef): z.ZodType {
    switch (def.type) {
        case "path":
            return textSchema(def)
                .refine((v) => v.startsWith("/"), "must be an absolute path")
                .refine((v) => !v.includes(","), "must not contain commas")
                .refine((v) => !v.split("/").includes(".."), "must not contain '..'");

        case "string":
            return textSchema(def);

        case "list":
            return z
                .array(
                    z
                        .string()
                        .trim()
                        .min(1)
                        .max(100)
                        .refine((v) => !v.startsWith("-"), "items must not start with '-'")
                        .refine((v) => !v.includes(","), "items must not contain commas")
                )
                .min(1, "at least one value is required")
                .max(50, "too many values");

        case "boolean":
            return z.boolean();

        case "number":
        case "count":
            return z
                .number()
                .int("must be a whole number")
                .min(def.min ?? 1, `must be at least ${def.min ?? 1}`)
                .max(def.max ?? 1000, `must be at most ${def.max ?? 1000}`);
    }
}

export type Options = Record<string, OptionValue>;

export function validateOptions(
    raw: Record<string, unknown>
): { success: true; data: Options } | { success: false; error: string } {
    const data: Options = {};

    for (const [key, value] of Object.entries(raw)) {
        const def = DEF_MAP.get(key);

        if (!def) {
            return { success: false, error: `Unknown option: ${key}` };
        }

        const result = schemaFor(def).safeParse(value);

        if (!result.success) {
            return {
                success: false,
                error: `${def.label}: ${result.error.issues[0]?.message ?? "invalid value"}`,
            };
        }

        // A switched-off flag is the same as not passing it
        if (def.type === "boolean" && result.data === false) {
            continue;
        }

        data[key] = result.data as OptionValue;
    }

    return { success: true, data };
}

// ------------------------------------------------------------------
// Command building
// ------------------------------------------------------------------

/**
 * Turns validated options into ansible-playbook arguments.
 * Values use the --flag=value form so a value can never be read as
 * a separate option.
 */
export function buildAnsibleArgs(options: Options): string[] {
    const args: string[] = [];

    for (const [key, value] of Object.entries(options)) {
        const def = DEF_MAP.get(key);

        if (!def) continue;

        switch (def.type) {
            case "boolean":
                if (value === true) args.push(def.flag);
                break;

            case "count":
                args.push("-" + "v".repeat(Number(value)));
                break;

            case "list":
                args.push(`${def.flag}=${(value as string[]).join(",")}`);
                break;

            default:
                args.push(`${def.flag}=${String(value)}`);
        }
    }

    return args;
}