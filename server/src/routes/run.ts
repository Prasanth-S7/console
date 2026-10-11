import type { Request, Response } from "express";
import { Router } from "express";
import { runSchema } from "../types/index.js";
import { prisma } from "../lib/prisma.js";
import { OPTION_DEFS, validateOptions } from "../lib/ansibleOptions.js";

export const run: Router = Router();

// The frontend builds its Options form from this list
run.get("/options", (_req: Request, res: Response) => {
    return res.status(200).json({ options: OPTION_DEFS });
});

run.post("/", async (req: Request, res: Response) => {
    try {
        const parsedResponse = runSchema.safeParse(req.body);

        if (!parsedResponse.success) {
            return res.status(400).json({
                msg: parsedResponse.error.issues[0]?.message ?? "Bad request body",
            });
        }

        const {
            playbook_id: playbookId,
            options: rawOptions,
            arguments: playbookArgs,
        } = parsedResponse.data;

        const validatedOptions = validateOptions(rawOptions ?? {});

        if (!validatedOptions.success) {
            return res.status(400).json({ msg: validatedOptions.error });
        }

        const executedById = req.user?.userId;

        if (!executedById) {
            return res.status(401).json({ msg: "Unauthorized" });
        }

        const playbook = await prisma.playbook.findUnique({
            where: { id: playbookId },
        });

        if (!playbook) {
            return res.status(404).json({ msg: "Playbook not found" });
        }

        const execution = await prisma.execution.create({
            data: {
                playbookId,
                executedById,
                arguments: playbookArgs,
                options: validatedOptions.data,
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
        return res.status(500).json({ msg: "Internal Server Error" });
    }
});