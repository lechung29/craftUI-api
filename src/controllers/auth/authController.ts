/** @format */

import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import Users, { IResponseStatus, IUserStatus, type IUserData } from "../../models/users/usersModel.js";
import PRTokens from "../../models/otps/PRTokensModel.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.js";
import { Resend } from "resend";

//#region Register New User

const registerUser: RequestHandler = async (req: Request<{}, {}, Pick<IUserData, "username" | "email" | "password">, {}>, res: Response) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Please fill in all required information: username, email and password",
        });
    }
    if (typeof username !== "string" || username.trim().length === 0) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Username is invalid",
        });
    }

    if (username.trim().length < 3) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Username must be at least 3 characters",
        });
    }

    if (username.trim().length > 50) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Username must not exceed 50 characters",
        });
    }

    if (typeof email !== "string" || email.trim().length === 0) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Email is invalid",
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Email address is not in the correct format. Please enter a valid email (example: example@domain.com)",
        });
    }

    if (email.trim().length > 255) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Email must not exceed 255 characters",
        });
    }

    if (typeof password !== "string" || password.length === 0) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Password is invalid",
        });
    }

    if (password.length < 6) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Password must be at least 6 characters",
        });
    }

    if (password.length > 128) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Password must not exceed 128 characters",
        });
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!strongPasswordRegex.test(password)) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Password must contain at least one uppercase letter, one lowercase letter and one number",
        });
    }

    const sanitizedusername = username.trim();
    const sanitizedEmail = email.trim().toLowerCase();

    try {
        const existingEmail = await Users.findOne({ email: sanitizedEmail });
        if (existingEmail) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "The email you entered is already registered with another account. Please use a different email address to continue registration",
            });
        }
        const existingusername = await Users.findOne({ username: sanitizedusername });
        if (existingusername) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Username already exists. Please choose another name",
            });
        }

        const hashPassword = bcryptjs.hashSync(password, 10);

        const newCustomer = new Users({
            username: sanitizedusername,
            email: sanitizedEmail,
            password: hashPassword,
        });

        await newCustomer.save();

        return res.status(201).send({
            status: IResponseStatus.Success,
            message: "Welcome! Your account has been created successfully and is now activated. You can start using our services",
        });
    } catch (error: any) {
        console.error("Registration error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

//#endregion

//#region Login User

const loginUser: RequestHandler = async (req: Request<{}, {}, Pick<IUserData, "email" | "password">>, res: Response) => {
    const { email, password } = req.body;

    if (!email || typeof email !== "string" || email.trim().length === 0) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Email is required",
        });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Email address is not in a valid format",
        });
    }

    if (!password || typeof password !== "string") {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Password is required",
        });
    }

    if (password.length < 6 || password.length > 128) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Password must be between 6 and 128 characters",
        });
    }

    try {
        const user = await Users.findOne({ email: sanitizedEmail });
        if (!user) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "The email address you entered is not associated with any account. Please check your email or register if you don't have an account",
            });
        }

        if (user.status === IUserStatus.Deleted) {
            return res.status(403).send({
                status: IResponseStatus.Error,
                message: "The email address you entered is not associated with any account. Please check your email or register if you don't have an account",
            });
        }

        const passwordMatches = bcryptjs.compareSync(password, user.password);
        if (!passwordMatches) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "The password you entered is incorrect. Please check again. If you forgot your password, you can reset it by using the password recovery flow",
            });
        }

        const accessToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET!, { expiresIn: "10m" });
        const currentRefreshToken = jwt.sign({ id: user.id, email: user.email, username: user.username }, process.env.JWT_SECRET!, { expiresIn: "1y" });

        await user.updateOne({ $push: { refreshToken: currentRefreshToken } });

        const { password: _pw, refreshToken, ...rest } = user.toObject();

        return res
            .status(200)
            .cookie("refreshToken", currentRefreshToken, { httpOnly: true, secure: true, sameSite: "none" })
            .send({
                status: IResponseStatus.Success,
                message: "Welcome! You have successfully logged into your account",
                data: {
                    ...rest,
                    accessToken,
                },
            });
    } catch (error: any) {
        console.error("Login error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const loginWithGoogle: RequestHandler = async (req: Request, res: Response) => {
    const { email, avatar } = req.body;

    try {
        let existingUser = await Users.findOne({ email });

        if (existingUser && existingUser.status === IUserStatus.Deleted) {
            return res.status(403).send({
                status: IResponseStatus.Error,
                message: "The email address you entered is not associated with any account. Please check your email or register if you don't have an account",
            });
        }

        if (!existingUser) {
            const newUser = new Users({
                username: email.split("@")[0],
                email,
                avatar: avatar,
                password: bcryptjs.hashSync(Math.random().toString(36), 10),
            });

            await newUser.save();
            existingUser = newUser;
        }

        const accessToken = await jwt.sign({ id: existingUser.id, username: existingUser.username }, process.env.JWT_SECRET!, { expiresIn: "10m" });
        const currentRefreshToken = jwt.sign({ id: existingUser.id, email: existingUser.email, username: existingUser.username }, process.env.JWT_SECRET!, { expiresIn: "1y" });

        await existingUser.updateOne({ $push: { refreshToken: currentRefreshToken } });

        const { password, refreshToken, ...rest } = existingUser.toObject();

        return res
            .status(200)
            .cookie("refreshToken", currentRefreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
            })
            .send({
                status: IResponseStatus.Success,
                message: "Welcome! You have successfully logged into your account",
                data: {
                    ...rest,
                    accessToken,
                },
            });
    } catch (error: any) {
        console.error("Google login error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const logoutUser: RequestHandler = async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            const user = await Users.findOne({ refreshToken: refreshToken });
            if (user) {
                user.refreshToken = user.refreshToken.filter((token) => token !== refreshToken);
                await user.save();
            }
        }

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Logout successfully",
        });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

//#region Refresh Token

const refreshToken: RequestHandler = async (req: Request, res: Response, _next: NextFunction) => {
    const cookieRefreshToken = req.cookies?.refreshToken;

    if (!cookieRefreshToken) {
        return res.status(200).send({
            status: IResponseStatus.Error,
            message: "Your session has expired. Please log in again",
        });
    }

    try {
        const decoded = jwt.verify(cookieRefreshToken, process.env.JWT_SECRET!) as any;

        if (!decoded || !decoded.id) {
            return res.status(200).send({
                status: IResponseStatus.Error,
                message: "Invalid session token. Please log in again",
            });
        }

        const user = await Users.findById(decoded.id);

        if (!user) {
            return res.status(200).send({
                status: IResponseStatus.Error,
                message: "User not found. Please log in again",
            });
        }

        if (!user.refreshToken.includes(cookieRefreshToken)) {
            return res.status(200).send({
                status: IResponseStatus.Error,
                message: "Your session has expired. Please log in again",
            });
        }

        const newAccessToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET!, { expiresIn: "10m" });

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Access token refreshed successfully",
            data: {
                accessToken: newAccessToken,
            },
        });
    } catch (error: any) {
        console.error("Refresh token error:", error);
        return res.status(401).send({
            status: IResponseStatus.Error,
            message: "Your session has expired. Please log in again",
        });
    }
};

//#region request password recovery

const requestPasswordRecovery: RequestHandler = async (req, res) => {
    const { email } = req.body;

    const validCustomer = await Users.findOne({ email });
    if (!validCustomer) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            fieldError: "email",
             message: "The email address you entered is not associated with any account. Please check your email or register if you don't have an account",
        });
    }

    const existingOtp = await PRTokens.findOne({ customerEmail: email });
    if (existingOtp) {
        return res.status(200).send({
            requestStatus: IResponseStatus.Success,
            message: "OTP sent successfully",
        });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MY_EMAIL,
            pass: process.env.MY_PASSWORD,
        },
    });

    const generationToken = uuidv4().replace(/-/g, "");
        const code = generationToken
            .split("")
            .sort(() => 0.5 - Math.random())
            .slice(0, 6)
            .join("");
    const digits = code.split("");

    const newOtp = new PRTokens({
        token: generationToken,
        customerEmail: email,
    });

    try {
        await newOtp.save();

        await transporter.sendMail({
            from: process.env.MY_EMAIL,
            to: email,
            subject: "Your CraftUI password reset code",
            html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0b0e14;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#06b6d4 100%);padding:40px 32px;text-align:center;">
        <div style="margin-bottom:8px;">
          <span style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Craft</span>
          <span style="font-size:28px;font-weight:700;color:#bfdbfe;">UI</span>
        </div>
        <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:0;letter-spacing:0.5px;">
          Create &amp; share reusable React components
        </p>
      </div>

      <!-- Body -->
      <div style="background:#12141b;padding:36px 32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0 0 10px;">
          Hello <strong style="color:#ffffff;">${validCustomer.username}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.75;margin:0 0 28px;">
          Use the code below to reset your CraftUI password.
          Enter it in the app within <strong style="color:rgba(255,255,255,0.8);">15 minutes</strong>.
        </p>

        <!-- OTP digits -->
        <div style="text-align:center;margin:0 0 28px;">
          ${digits.map((d) => `<span style="display:inline-block;width:48px;height:56px;line-height:56px;margin:0 4px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.35);border-radius:10px;font-size:26px;font-weight:700;color:#a5b4fc;">${d}</span>`).join("")}
        </div>

        <!-- Warning box -->
        <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:16px 20px;">
          <p style="color:#fbbf24;font-size:13px;font-weight:600;margin:0 0 8px;">Important notice</p>
          <ul style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.9;margin:0;padding-left:16px;">
            <li>This code expires in <strong style="color:rgba(255,255,255,0.7);">5 minutes</strong></li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Never share this code with anyone</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#0d0f17;border-top:1px solid rgba(255,255,255,0.06);padding:24px 32px;text-align:center;">
        <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0 0 4px;">
          &copy; 2025 CraftUI. All rights reserved.
        </p>
        <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">
          You received this email because you have a CraftUI account.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`,
        });

        return res.status(200).send({
            requestStatus: IResponseStatus.Success,
            message: "Send OTP successfully",
        });
    } catch (error) {
        await PRTokens.deleteOne({ customerEmail: email, token: generationToken }).catch(() => {});
        return res.status(500).send({
            requestStatus: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const verifyRecoveryPasswordToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { email, token } = req.query;

    try {
        const validToken = await PRTokens.findOne({ customerEmail: email, token });
        if (!validToken) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "Your OTP code expired",
            });
        }

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Verified successfully!",
        });
    } catch (error) {
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const resetPasswordByRPToken: RequestHandler = async (req: Request, res: Response) => {
    const { email } = req.body;

    const validCustomer = await Users.findOne({ email: email });
    if (!validCustomer) {
        return res.status(200).send({
            status: IResponseStatus.Error,
            message: "The email address you entered is not associated with any account. Please check your email or register if you don't have an account",
        });
    }

    req.body.password = bcryptjs.hashSync(req.body.password, 13);

    try {
        await Users.findOneAndUpdate(
            {
                email: email,
            },
            {
                $set: {
                    password: req.body.password,
                },
            },
            { new: true },
        )
            .lean()
            .exec();
        await PRTokens.findOneAndDelete({ customerEmail: email });

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Update password successfully!",
        });
    } catch (error) {
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const verifyAccessToken: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    return res.status(200).send({
        status: IResponseStatus.Success,
        message: "Token is valid",
    });
};

export { registerUser, loginUser, refreshToken, logoutUser, loginWithGoogle, requestPasswordRecovery, verifyRecoveryPasswordToken, resetPasswordByRPToken, verifyAccessToken };
