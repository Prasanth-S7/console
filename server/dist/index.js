import "dotenv/config";
import express from "express";
import cors from "cors";
import { run } from "./routes/run.js";
import { PORT } from "./constants/constant.js";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middleware/auth.js";
import { login } from "./routes/login.js";
import { signup } from "./routes/signup.js";
const app = express();
const router = express.Router();
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.get("/health", (req, res) => {
    return res.status(200).json({
        msg: "Healthy"
    });
});
app.use(authMiddleware);
router.use("/auth", login);
router.use("/auth", signup);
router.use("/run", run);
app.listen(PORT, () => {
    console.log("Server is running on port 3000");
});
//# sourceMappingURL=index.js.map