/** @format */

import express from "express";
import { deleteUser, getTopUsers, getUserById, getUserStats, updateEmailSettings, updateUser } from "../controllers/user/userController.js";
import { verifyToken } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.get("/top-creators", getTopUsers);
userRouter.get("/stats", verifyToken, getUserStats);
userRouter.get("/:id", getUserById);
userRouter.patch("/:id", verifyToken, updateUser);
userRouter.delete("/:id", verifyToken, deleteUser);
userRouter.patch("/:id/settings/email", verifyToken, updateEmailSettings);

export default userRouter;
