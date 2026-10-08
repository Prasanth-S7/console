import "dotenv/config"
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
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ['GET', 'PUT', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(router)

app.use(cookieParser());


app.get("/health", (req, res) => {
    return res.status(200).json({
        msg: "Healthy"
    })
})

router.use("/auth", signup)
router.use("/run", authMiddleware, run);

app.listen(PORT, () => {
    console.log("Server is running on port 3000");
})