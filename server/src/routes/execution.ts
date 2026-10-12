import { Router } from "express";
import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "../lib/prisma.js";

export const executions: Router = Router();

// Must match the LOG_DIR the worker writes to
const LOG_DIR = path.resolve(process.env.LOG_DIR ?? "logs");

// Very large logs return only the last 2 MB
const MAX_LOG_BYTES = 2 * 1024 * 1024;

executions.get("/", async (_req: Request, res: Response) => {
    try {
        const rows = await prisma.execution.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                status: true,
                createdAt: true,
                startedAt: true,
                finishedAt: true,
                exitCode: true,
                logPath: true,
                playbook: { select: { id: true, name: true } },
                executedBy: { select: { userId: true, email: true } },
            },
        });

        // Tell the frontend whether a log exists, without exposing the path
        const items = rows.map(({ logPath, ...rest }) => ({
            ...rest,
            hasLog: logPath !== null,
        }));

        return res.status(200).json({ executions: items });
    } catch (error) {
        console.error("Failed to get executions:", error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
});

executions.get("/:id/log", async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ msg: "Invalid execution id" });
        }

        const execution = await prisma.execution.findUnique({
            where: { id },
            select: { logPath: true },
        });

        if (!execution?.logPath) {
            return res.status(404).json({ msg: "No log for this execution" });
        }

        let realPath: string;

        try {
            realPath = await fs.realpath(execution.logPath);
        } catch {
            return res.status(404).json({ msg: "Log file not found on the server" });
        }

        // Only files inside LOG_DIR can be served
        const base = await fs.realpath(LOG_DIR);

        if (!realPath.startsWith(base + path.sep)) {
            return res.status(403).json({ msg: "Forbidden" });
        }

        const handle = await fs.open(realPath, "r");

        try {
            const { size } = await handle.stat();
            const length = Math.min(size, MAX_LOG_BYTES);

            const buffer = Buffer.alloc(length);
            await handle.read(buffer, 0, length, size - length);

            let text = buffer.toString("utf8");

            if (size > MAX_LOG_BYTES) {
                text =
                    `... log truncated, showing the last ${MAX_LOG_BYTES / 1024 / 1024} MB ...\n\n` +
                    text;
            }

            return res.status(200).type("text/plain").send(text);
        } finally {
            await handle.close();
        }
    } catch (error) {
        console.error("Failed to read execution log:", error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
});