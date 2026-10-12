import "dotenv/config"
import express from "express";
import cors from "cors";
import { run } from "./routes/run.js";
import { PORT } from "./constants/constant.js";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middleware/auth.js";
import { auth } from "./routes/auth.js";
import { playbooks } from "./routes/playbook.js";
import { executions } from "./routes/execution.js"

const app = express();

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:4173", "https://console.devprasanth.in"],
    methods: ['GET', 'PUT', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(cookieParser());
app.use(express.json());

const router = express.Router();
app.use(router)

app.get("/health", (req, res) => {
    return res.status(200).json({
        msg: "Healthy"
    })
})

router.use("/auth", auth)
router.use("/run", authMiddleware, run);
router.use("/playbooks", authMiddleware, playbooks);
router.use("/executions", authMiddleware, executions);

app.listen(PORT, () => {
    console.log("Server is running on port 3000");
})