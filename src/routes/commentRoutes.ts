/** @format */

import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { addComment, deleteComment, getComments, voteComment } from "../controllers/comments/commentControler.js";

const commentRouter = Router();

commentRouter.get("/:componentId", getComments);
commentRouter.post("/", verifyToken, addComment);
commentRouter.post("/:commentId/vote", verifyToken, voteComment);
commentRouter.delete("/:commentId", verifyToken, deleteComment);

export default commentRouter;
