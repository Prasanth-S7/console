import "dotenv/config"
import express from "express";
import cors from "cors";
import { run } from "./routes/run.js";
import { PORT } from "./constants/constant.js";

const app = express();
const router = express.Router();

app.use(cors());

app.use(express.json());

app.get("/health", (req, res) => {
    return res.status(200).json({
        msg: "Healthy"
    })
})

router.use("/run", run);

app.listen(PORT, () => {
    console.log("Server is running on port 3000");
})