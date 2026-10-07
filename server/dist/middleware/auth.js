import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../constants/constant.js";
export const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ msg: "Unauthorized: No token provided" });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ msg: "Unauthorized: Invalid or expired token" });
    }
};
//# sourceMappingURL=auth.js.map