import "dotenv/config";

import { spawn } from "node:child_process";
import { prisma } from "./lib/prisma.js";

const POLL_INTERVAL = 2000;

let shuttingDown = false;

async function getNextExecution() {
    return prisma.execution.findFirst({
        where: {
            status: "QUEUED",
        },
        orderBy: {
            createdAt: "asc",
        },
        include: {
            playbook: true,
        },
    });
}

async function runExecution(executionId: number): Promise<void> {
    const execution = await prisma.execution.findUnique({
        where: {
            id: executionId,
        },
        include: {
            playbook: true,
        },
    });

    if (!execution || execution.status !== "QUEUED") {
        return;
    }

    await prisma.execution.update({
        where: {
            id: executionId,
        },
        data: {
            status: "RUNNING",
            startedAt: new Date(),
        },
    });

    const extraVars = JSON.stringify(execution.arguments ?? {});

    return new Promise((resolve) => {
        const child = spawn(
            "ansible-playbook",
            [
                execution.playbook.path,
                "--extra-vars",
                extraVars,
            ],
            {
                shell: false,
            }
        );

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

            console.error(
                `[Execution ${executionId}] Failed to start:`,
                error
            );

            try {
                await prisma.execution.update({
                    where: {
                        id: executionId,
                    },
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
                    where: {
                        id: executionId,
                    },
                    data: {
                        status: code === 0 ? "SUCCESS" : "FAILED",
                        finishedAt: new Date(),
                        exitCode: code,
                        stdout,
                        stderr,
                    },
                });

                console.log(
                    `[Execution ${executionId}] ${
                        code === 0 ? "SUCCESS" : "FAILED"
                    }`
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