import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "./lib/prisma.js";

const POLL_INTERVAL = 2000;

let shuttingDown = false;

async function getNextExecution() {
    return prisma.execution.findFirst({
        where: { status: "QUEUED" },
        orderBy: { createdAt: "asc" },
        include: { playbook: true },
    });
}

/**
 * Resolves the inventory path and makes sure it exists and is a file.
 * If INVENTORY_ALLOWED_DIR is set, the file must live inside that directory.
 */
async function resolveInventory(inventoryPath: string): Promise<string> {
    const resolved = await fs.realpath(inventoryPath);

    const allowedDir = process.env.INVENTORY_ALLOWED_DIR;

    if (allowedDir) {
        const base = await fs.realpath(allowedDir);

        if (!resolved.startsWith(base + path.sep)) {
            throw new Error(`Inventory must be inside ${base}`);
        }
    }

    const stat = await fs.stat(resolved);

    if (!stat.isFile()) {
        throw new Error(`Inventory is not a file: ${inventoryPath}`);
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

    await prisma.execution.update({
        where: { id: executionId },
        data: {
            status: "RUNNING",
            startedAt: new Date(),
        },
    });

    // ---- Validate inventory (if one was supplied) ----
    let inventoryPath: string | undefined;

    if (execution.inventoryPath) {
        try {
            inventoryPath = await resolveInventory(execution.inventoryPath);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Invalid inventory";

            console.error(`[Execution ${executionId}] Inventory error: ${message}`);

            await prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: "FAILED",
                    finishedAt: new Date(),
                    stderr: `Inventory error: ${message}`,
                },
            });

            return;
        }
    }

    // ---- Build the command ----
    const command = "ansible-playbook";

    const args: string[] = [execution.playbook.path];

    if (inventoryPath) {
        args.push("-i", inventoryPath);
    }

    args.push("--extra-vars", JSON.stringify(execution.arguments ?? {}));

    console.log("Executing command:", command, ...args);

    return new Promise((resolve) => {
        const child = spawn(command, args, { shell: false });

        let stdout = "";
        let stderr = "";
        let spawnFailed = false;

        child.stdout.on("data", (data: Buffer) => {
            const output = data.toString();

            stdout += output;
            process.stdout.write(`[Execution ${executionId}] ${output}`);
        });

        child.stderr.on("data", (data: Buffer) => {
            const output = data.toString();

            stderr += output;
            process.stderr.write(`[Execution ${executionId}] ${output}`);
        });

        child.on("error", async (error) => {
            spawnFailed = true;

            console.error(`[Execution ${executionId}] Failed to start:`, error);

            try {
                await prisma.execution.update({
                    where: { id: executionId },
                    data: {
                        status: "FAILED",
                        finishedAt: new Date(),
                        stderr: error.message,
                    },
                });
            } finally {
                resolve();
            }
        });

        child.on("close", async (code) => {
            if (spawnFailed) {
                return;
            }

            try {
                await prisma.execution.update({
                    where: { id: executionId },
                    data: {
                        status: code === 0 ? "SUCCESS" : "FAILED",
                        finishedAt: new Date(),
                        exitCode: code,
                        stdout,
                        stderr,
                    },
                });

                console.log(
                    `[Execution ${executionId}] ${code === 0 ? "SUCCESS" : "FAILED"}`
                );
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
    console.log("ServAuto worker started");

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