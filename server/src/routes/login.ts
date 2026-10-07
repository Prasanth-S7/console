import { Router } from 'express';
import type { Request, Response } from "express";
import { loginSchema } from '../types/index.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from '../constants/constant.js';
import { prisma } from '../lib/prisma.js';

export const login: Router = Router();

login.post("/login", async (req: Request, res: Response) => {
    try {
        const parsedResponse = loginSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            return res.status(400).json({ msg: "Bad request body" });
        }

        const { email, password } = parsedResponse.data;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(401).json({ msg: "Invalid email or password" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ msg: "Invalid email or password" });
        }

        const token = jwt.sign(
            { userId: user.userId, email: user.email },
            JWT_SECRET!,
            { expiresIn: "1d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24,
        });

        return res.status(200).json({
            msg: "Login successful",
            email: user.email,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
});