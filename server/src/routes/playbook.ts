import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { playbookSchema } from "../types/index.js";

export const playbooks: Router = Router();

playbooks.get("/", async (req: Request, res: Response) => {
  try {
    const list = await prisma.playbook.findMany({
      select: { id: true, name: true, description: true, path: true },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ playbooks: list });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

playbooks.post("/add", async (req: Request, res: Response) => {
  try {
    const parsed = playbookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ msg: "Bad request body" });
    }

    const playbook = await prisma.playbook.create({ data: {
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        path: parsed.data.path
    }});

    return res.status(201).json({ msg: "Playbook saved", playbook });
  } catch (error: any) {
    // name and path are @unique in schema
    if (error?.code === "P2002") {
      return res.status(409).json({ msg: "A playbook with this name or path already exists" });
    }
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});