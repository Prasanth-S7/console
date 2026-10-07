import type { Request, Response } from 'express';
import { Router } from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runSchema } from '../types/index.js';
import { prisma } from "../lib/prisma.js"

const execFileAsync = promisify(execFile);

export const run: Router = Router();

run.post('/', async (req: Request, res: Response) => {
    try {
        const parsedResponse = runSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            return res.status(400).json({
                msg: "Bad request body"
            });
        }

        const playbookId = parsedResponse.data.playbook_id;
        const playbookArgs: Record<string, string[]> = parsedResponse.data.arguments;

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

        const extraVars = JSON.stringify(playbookArgs);

        const { stdout, stderr } = await execFileAsync('ansible-playbook', [
            playbook.path,
            '--extra-vars',
            extraVars,
        ]);

        await prisma.history.create({
            data: {
                executedAt: new Date(),
                executedById,
                playbookId,
            },
        });

        return res.status(200).json({
            msg: "Playbook executed",
            stdout,
            stderr,
        });

    } catch (error: any) {
        console.error(error);
        return res.status(500).json({
            msg: "Internal Server Error",
            detail: error?.stderr ?? error?.message,
        });
    }
});