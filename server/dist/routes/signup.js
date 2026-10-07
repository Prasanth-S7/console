import { Router } from 'express';
import { signupSchema } from '../types/index.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from '../constants/constant.js';
import { prisma } from '../lib/prisma.js';
export const signup = Router();
signup.post("/signup", async (req, res) => {
    try {
        const parsedResponse = signupSchema.safeParse(req.body);
        if (!parsedResponse.success) {
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
        const token = jwt.sign({ userId: insertUser.userId, email: insertUser.email }, JWT_SECRET, { expiresIn: "1d" });
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
//# sourceMappingURL=signup.js.map