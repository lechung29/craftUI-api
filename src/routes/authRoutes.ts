/** @format */

import express from "express";
import {
    loginUser,
    loginWithGoogle,
    logoutUser,
    refreshToken,
    registerUser,
    requestPasswordRecovery,
    resetPasswordByRPToken,
    verifyAccessToken,
    verifyRecoveryPasswordToken,
} from "../controllers/auth/authController.js";
import { verifyToken } from "../middlewares/auth.js";

const authRouter = express.Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/logout", logoutUser);
authRouter.post("/login/google", loginWithGoogle);
authRouter.post("/forgot-password", requestPasswordRecovery);
authRouter.get("/forgot-password/validate", verifyRecoveryPasswordToken);
authRouter.put("/forgot-password/reset", resetPasswordByRPToken);
// authRouter.post("/forgot-password", requestPasswordRecovery);
// authRouter.get("/validation-recovery-password-token", verifyRecoveryPasswordToken);
// authRouter.put("/recovery-password", resetPasswordByRPToken);
authRouter.get("/refresh-token", refreshToken);
authRouter.get("/verify-token", verifyToken, verifyAccessToken);

export default authRouter;
