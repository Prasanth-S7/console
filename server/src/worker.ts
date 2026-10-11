import "dotenv/config";

import fs from "node:fs/promises";
import { createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "./lib/prisma.js";

import {
    OPTION_DEFS,
    buildAnsibleArgs,
    validateOptions,
    type Options,
} from "./lib/ansibleOptions.js";

const POLL_INTERVAL = 2000;
const LOG_DIR = path.resolve(process.env.LOG_DIR ?? "logs");

let shuttingDown = false;

async function getNextExecution() {
    return prisma.execution.findFirst({
        where: { status: "QUEUED" },
        orderBy: { createdAt: "asc" },
        include: { playbook: true },
    });
}

function getLogPath(executionId: number) {
    return path.join(LOG_DIR, `execution-${executionId}.log`);
}

/** Ends the stream and waits until everything is flushed to disk. */
function closeLog(stream: WriteStream): Promise<void> {
    return new Promise((resolve) => {
        stream.end(() => resolve());
    });
}

const DIVIDER = "=".repeat(60);

async function resolvePathOptions(options: Options): Promise<Options> {
    const resolved: Options = { ...options };

    const allowedDir = process.env.OPTIONS_ALLOWED_DIR
        ? await fs.realpath(process.env.OPTIONS_ALLOWED_DIR)
        : undefined;

    for (const def of OPTION_DEFS) {
        if (def.type !== "path") continue;

        const value = options[def.key];

        if (typeof value !== "string") continue;

        let real: string;

        try {
            real = await fs.realpath(value);
        } catch {
            throw new Error(`${def.label}: file not found (${value})`);
        }

        if (allowedDir && !real.startsWith(allowedDir + path.sep)) {
            throw new Error(`${def.label}: must be inside ${allowedDir}`);
        }

        const stat = await fs.stat(real);

        if (!stat.isFile()) {
            throw new Error(`${def.label}: not a file (${value})`);
        }

        resolved[def.key] = real;
    }

    return resolved;
}


async function runExecution(executionId: number): Promise<void> {
    const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: { playbook: true },
    });

    if (!execution || execution.status !== "QUEUED") {
        return;
    }

    // ---- Open the log file for this execution ----
    const logPath = getLogPath(executionId);

    const log = createWriteStream(logPath, { flags: "w", mode: 0o640 });

    log.on("error", (error) => {
        console.error(`[Execution ${executionId}] Log write error:`, error);
    });

    log.write(
        [
            DIVIDER,
            `ServAuto Execution #${executionId}`,
            `Playbook : ${execution.playbook.name}`,
            `Started  : ${new Date().toISOString()}`,
            DIVIDER,
            "",
            "",
        ].join("\n")
    );

    // logPath is saved immediately so the log is reachable while it's running
    await prisma.execution.update({
        where: { id: executionId },
        data: {
            status: "RUNNING",
            startedAt: new Date(),
            logPath,
        },
    });

    /** Writes the footer, flushes the log, then records the final state. */
    const finalize = async (
        status: "SUCCESS" | "FAILED",
        exitCode: number | null,
        summary: string
    ) => {
        log.write(
            [
                "",
                DIVIDER,
                summary,
                `Finished : ${new Date().toISOString()}`,
                DIVIDER,
                "",
            ].join("\n")
        );

        // Wait for the file to be fully written BEFORE the status flips,
        // so anyone who sees SUCCESS/FAILED also sees the complete log.
        await closeLog(log);

        await prisma.execution.update({
            where: { id: executionId },
            data: {
                status,
                finishedAt: new Date(),
                exitCode,
            },
        });
    };

    // ---- Validate inventory (if one was supplied) ----

    let optionArgs: string[] = [];

    try {
        const validated = validateOptions(
            (execution.options ?? {}) as Record<string, unknown>
        );

        if (!validated.success) {
            throw new Error(validated.error);
        }

        const resolved = await resolvePathOptions(validated.data);

        optionArgs = buildAnsibleArgs(resolved);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Invalid options";

        console.error(`[Execution ${executionId}] Option error: ${message}`);

        await finalize("FAILED", null, `Option error: ${message}`);

        return;
    }

    // ---- Build the command ----
    const command = "ansible-playbook";

    const args: string[] = [
        execution.playbook.path,
        ...optionArgs,
        "--extra-vars",
        JSON.stringify(execution.arguments ?? {}),
    ];
 

    console.log("Executing command:", command, ...args);

    log.write(`$ ${command} ${args.join(" ")}\n\n`);

    return new Promise((resolve) => {
        const child = spawn(command, args, { shell: false });

        let spawnFailed = false;

        // stdout and stderr go into the same file, in the order they arrive
        child.stdout.on("data", (data: Buffer) => {
            log.write(data);
            process.stdout.write(`[Execution ${executionId}] ${data.toString()}`);
        });

        child.stderr.on("data", (data: Buffer) => {
            log.write(data);
            process.stderr.write(`[Execution ${executionId}] ${data.toString()}`);
        });

        child.on("error", async (error) => {
            spawnFailed = true;

            console.error(`[Execution ${executionId}] Failed to start:`, error);

            try {
                await finalize("FAILED", null, `Failed to start: ${error.message}`);
            } catch (dbError) {
                console.error(
                    `[Execution ${executionId}] Finalize failed:`,
                    dbError
                );
            } finally {
                resolve();
            }
        });

        child.on("close", async (code, signal) => {
            if (spawnFailed) {
                return;
            }

            const status = code === 0 ? "SUCCESS" : "FAILED";

            try {
                await finalize(
                    status,
                    code,
                    signal
                        ? `Terminated by signal ${signal}`
                        : `Exit code: ${code}`
                );

                console.log(`[Execution ${executionId}] ${status}`);
            } catch (error) {
                console.error(
                    `[Execution ${executionId}] Database update failed:`,
                    error
                );
            } finally {
                resolve();
            }
        });
    });
}

async function worker() {
    await fs.mkdir(LOG_DIR, { recursive: true });

    console.log("ServAuto worker started");
    console.log(`Logs directory: ${LOG_DIR}`);

    while (!shuttingDown) {
        try {
            const execution = await getNextExecution();

            if (!execution) {
                await sleep(POLL_INTERVAL);
                continue;
            }

            await runExecution(execution.id);
        } catch (error) {
            console.error("Worker error:", error);
            await sleep(POLL_INTERVAL);
        }
    }
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function shutdown() {
    console.log("Worker shutting down...");

    shuttingDown = true;

    await prisma.$disconnect();

    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

worker().catch(async (error) => {
    console.error("Fatal worker error:", error);

    await prisma.$disconnect();

    process.exit(1);
});