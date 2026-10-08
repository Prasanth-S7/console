import type { Request, Response } from "express";
import { Router } from "express";
import { runSchema } from "../types/index.js";
import { prisma } from "../lib/prisma.js";

export const run: Router = Router();

run.post("/", async (req: Request, res: Response) => {
    try {
        const parsedResponse = runSchema.safeParse(req.body);

        if (!parsedResponse.success) {
            return res.status(400).json({
                msg: "Bad request body",
            });
        }

        const playbookId = parsedResponse.data.playbook_id;
        const playbookArgs = parsedResponse.data.arguments;

        const executedById = req.user?.userId;

        if (!executedById) {
            return res.status(401).json({
                msg: "Unauthorized",
            });
        }

        const playbook = await prisma.playbook.findUnique({
            where: {
                id: playbookId,
            },
        });

        if (!playbook) {
            return res.status(404).json({
                msg: "Playbook not found",
            });
        }

        const execution = await prisma.execution.create({
            data: {
                playbookId,
                executedById,
                arguments: playbookArgs,
                status: "QUEUED",
            },
        });

        return res.status(202).json({
            msg: "Playbook queued for execution",
            executionId: execution.id,
            status: execution.status,
        });
    } catch (error) {
        console.error("Failed to queue playbook:", error);

        return res.status(500).json({
            msg: "Internal Server Error",
        });
    }
});