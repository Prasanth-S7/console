import { Router } from "express";
import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.js";

export const executions: Router = Router();

executions.get("/", async (req: Request, res: Response) => {
  try {
    const executions = await prisma.execution.findMany({
      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        status: true,

        createdAt: true,
        startedAt: true,
        finishedAt: true,

        exitCode: true,

        playbook: {
          select: {
            id: true,
            name: true,
          },
        },

        executedBy: {
          select: {
            userId: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      executions,
    });
  } catch (error) {
    console.error(
      "Failed to get executions:",
      error
    );

    return res.status(500).json({
      msg: "Internal Server Error",
    });
  }
});