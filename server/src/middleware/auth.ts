import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../constants/constant.js";

interface JwtPayload {
    userId: number;
    email: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({ msg: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

        req.user = {
            userId: decoded.userId,
            email: decoded.email
        }

        next();
    }
    catch (error) {
        return res.status(401).json({ msg: "Unauthorized: Invalid or expired token" });
    }
};