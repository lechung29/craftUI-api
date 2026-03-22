/** @format */

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { connectDB } from "./config/database.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import componentRouter from "./routes/componentRoutes.js";
import commentRouter from "./routes/commentRoutes.js";

const app = express();
dotenv.config();

app.use(express.json());
app.use(
    cors({
        origin: ["http://localhost:5173", "https://craft-ui-phi.vercel.app"],
        credentials: true,
    }),
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const port = process.env.SERVER_PORT || 5000;
connectDB();

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/components", componentRouter);
app.use("/api/v1/comments", commentRouter);

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

app.listen(port, () => {
    console.log(`Server running on port:${port}`);
});
