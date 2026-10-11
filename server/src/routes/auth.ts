import { Router } from 'express';
import type { Request, Response } from "express";
import { signupSchema } from '../types/index.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from '../constants/constant.js';
import { prisma } from '../lib/prisma.js';
import { loginSchema } from '../types/index.js';

export const auth: Router = Router();

auth.post("/signup", async (req: Request, res: Response) => {
    try {
        console.log(req.body)
        const parsedResponse = signupSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            console.log(parsedResponse.error)
            return res.status(400).json({ msg: "Bad request body" });
        }

        const { email, password } = parsedResponse.data;

        const isExistingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (isExistingUser) {
            return res.status(409).json({ msg: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const insertUser = await prisma.user.create({
            data: { email, password: hashedPassword },
        });

        const token = jwt.sign(
            { userId: insertUser.userId, email: insertUser.email },
            JWT_SECRET!,
            { expiresIn: "1d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24,
        });

        return res.status(201).json({
            msg: "Sign up successful",
            email: insertUser.email,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
});

auth.post("/login", async (req: Request, res: Response) => {
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

auth.post("/logout", (_req: Request, res: Response) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
    });

    return res.status(200).json({ msg: "Logged out" });
});