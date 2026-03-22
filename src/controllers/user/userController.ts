/** @format */

import type { Request, Response, RequestHandler, NextFunction } from "express";
import Users, { IResponseStatus, IUserStatus, type IUserData } from "../../models/users/usersModel.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.js";
import Components, { ComponentStatus } from "../../models/components/componentsModel.js";
import mongoose from "mongoose";

const updateUser: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { username, location, company, twitter, websiteURL, biography, avatar, thumbnail } = req.body;

    // Validate user ID format (MongoDB ObjectId)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!id || !objectIdRegex.test(id)) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "Invalid user ID format",
        });
    }

    // Ensure at least one field is being updated
    if (!username && !location && !company && !twitter && !websiteURL && !biography && !avatar && !thumbnail) {
        return res.status(400).send({
            status: IResponseStatus.Error,
            message: "At least one field must be provided for update",
        });
    }

    // Username validation
    if (username !== undefined) {
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
                message: "Username must not exceed 30 characters",
            });
        }
    }

    // Location validation
    if (location !== undefined) {
        if (typeof location !== "string") {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Location is invalid",
            });
        }

        if (location.trim().length > 100) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Location must not exceed 100 characters",
            });
        }
    }

    // Company validation
    if (company !== undefined) {
        if (typeof company !== "string") {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Company is invalid",
            });
        }

        if (company.trim().length > 100) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Company must not exceed 100 characters",
            });
        }
    }

    // Twitter validation
    if (twitter !== undefined) {
        if (typeof twitter !== "string") {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Twitter handle is invalid",
            });
        }

        if (twitter.trim().length > 0) {
            // Remove @ if present
            const cleanTwitter = twitter.trim().replace(/^@/, "");

            if (cleanTwitter.length < 1 || cleanTwitter.length > 15) {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Twitter handle must be between 1 and 15 characters",
                });
            }

            const twitterRegex = /^[a-zA-Z0-9_]+$/;
            if (!twitterRegex.test(cleanTwitter)) {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Twitter handle can only contain letters, numbers, and underscores",
                });
            }
        }
    }

    // Website URL validation
    if (websiteURL !== undefined) {
        if (typeof websiteURL !== "string") {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Website URL is invalid",
            });
        }

        if (websiteURL.trim().length > 0) {
            try {
                const url = new URL(websiteURL.trim());
                if (url.protocol !== "http:" && url.protocol !== "https:") {
                    return res.status(400).send({
                        status: IResponseStatus.Error,
                        message: "Website URL must use HTTP or HTTPS protocol",
                    });
                }
            } catch (error) {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Invalid website URL format",
                });
            }

            if (websiteURL.trim().length > 2048) {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Website URL must not exceed 2048 characters",
                });
            }
        }
    }

    // Biography validation
    if (biography !== undefined) {
        if (typeof biography !== "string") {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Biography is invalid",
            });
        }

        if (biography.length > 500) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Bio must not exceed 500 characters",
            });
        }

        const lineBreaks = (biography.match(/\n/g) || []).length;
        if (lineBreaks > 10) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Bio contains too many line breaks (maximum 10)",
            });
        }
    }

    // Avatar URL validation
    if (avatar !== undefined) {
        if (typeof avatar !== "string" || avatar.trim().length === 0) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Avatar URL is invalid",
            });
        }

        try {
            const url = new URL(avatar.trim());
            if (url.protocol !== "http:" && url.protocol !== "https:") {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Avatar URL must use HTTP or HTTPS protocol",
                });
            }
        } catch (error) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid avatar URL format",
            });
        }

        if (avatar.trim().length > 2048) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Avatar URL must not exceed 2048 characters",
            });
        }

        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
        const url = new URL(avatar.trim());
        if (!imageExtensions.test(url.pathname)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Avatar URL must point to a valid image file (jpg, jpeg, png, gif, webp, svg)",
            });
        }
    }

    // Thumbnail URL validation
    if (thumbnail !== undefined) {
        if (typeof thumbnail !== "string" || thumbnail.trim().length === 0) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Thumbnail URL is invalid",
            });
        }

        try {
            const url = new URL(thumbnail.trim());
            if (url.protocol !== "http:" && url.protocol !== "https:") {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Thumbnail URL must use HTTP or HTTPS protocol",
                });
            }
        } catch (error) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid thumbnail URL format",
            });
        }

        if (thumbnail.trim().length > 2048) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Thumbnail URL must not exceed 2048 characters",
            });
        }

        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
        const url = new URL(thumbnail.trim());
        if (!imageExtensions.test(url.pathname)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Thumbnail URL must point to a valid image file (jpg, jpeg, png, gif, webp, svg)",
            });
        }
    }

    // Sanitize inputs
    const sanitizedUsername = username ? username.trim() : undefined;
    const sanitizedLocation = location !== undefined ? location.trim() : undefined;
    const sanitizedCompany = company !== undefined ? company.trim() : undefined;
    const sanitizedTwitter = twitter !== undefined ? twitter.trim().replace(/^@/, "") : undefined;
    const sanitizedWebsiteURL = websiteURL !== undefined ? websiteURL.trim() : undefined;
    const sanitizedBiography = biography !== undefined ? biography : undefined;
    const sanitizedAvatar = avatar ? avatar.trim() : undefined;
    const sanitizedThumbnail = thumbnail ? thumbnail.trim() : undefined;

    try {
        const updateData: Partial<IUserData> = {};
        if (sanitizedUsername !== undefined) updateData.username = sanitizedUsername;
        if (sanitizedLocation !== undefined) updateData.location = sanitizedLocation;
        if (sanitizedCompany !== undefined) updateData.company = sanitizedCompany;
        if (sanitizedTwitter !== undefined) updateData.twitter = sanitizedTwitter;
        if (sanitizedWebsiteURL !== undefined) updateData.websiteURL = sanitizedWebsiteURL;
        if (sanitizedBiography !== undefined) updateData.biography = sanitizedBiography;
        if (sanitizedAvatar !== undefined) updateData.avatar = sanitizedAvatar;
        if (sanitizedThumbnail !== undefined) updateData.thumbnail = sanitizedThumbnail;
        updateData.updatedAt = new Date();

        await Users.findByIdAndUpdate(id, updateData);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Your profile has been updated successfully",
        });
    } catch (error: any) {
        console.error("Update user error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const deleteUser: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "Unauthorized",
            });
        }
        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "User not found",
            });
        }

        if (user.status === IUserStatus.Deleted) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Account already deleted",
            });
        }
        user.status = IUserStatus.Deleted;
        user.updatedAt = new Date();
        await user.save();
        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Account deleted successfully",
        });
    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const updateEmailSettings: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { email, isReceiveEmailNotification } = req.body;
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
        const updatedUser = await Users.findByIdAndUpdate(
            userId,
            {
                email: email.trim().toLowerCase(),
                "settings.isReceiveEmailNotification": isReceiveEmailNotification,
            },
            { new: true, select: "-password -refreshToken" },
        );

        if (!updatedUser) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "User not found",
            });
        }

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Email settings updated successfully",
        });
    } catch (error) {
        console.error("Update settings error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getUserById: RequestHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const objectIdRegex = /^[0-9a-fA-F]{24}$/;
        if (!id || !objectIdRegex.test(id)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid user ID format",
            });
        }

        const user = await Users.findById(id).select("-password -refreshToken").lean();

        if (!user || user.status === IUserStatus.Deleted) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "User not found",
            });
        }

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "User retrieved successfully",
            data: user,
        });
    } catch (error) {
        console.error("Get user by id error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getTopUsers: RequestHandler = async (req: Request, res: Response) => {
    try {
        const users = await Users.aggregate([
            {
                $match: { status: { $ne: IUserStatus.Deleted } },
            },
            {
                $lookup: {
                    from: "components",
                    localField: "_id",
                    foreignField: "authorId",
                    as: "components",
                },
            },
            {
                $addFields: {
                    publishedComponents: {
                        $filter: {
                            input: "$components",
                            as: "component",
                            cond: { $eq: ["$$component.status", ComponentStatus.Published] },
                        },
                    },
                },
            },
            {
                $addFields: {
                    postCount: { $size: "$publishedComponents" },
                    totalSaves: { $sum: "$publishedComponents.saves" },
                    totalViews: { $sum: "$publishedComponents.views" },
                },
            },
            { $sort: { points: -1 } },
            { $limit: 9 },
            {
                $project: {
                    password: 0,
                    refreshToken: 0,
                    components: 0,
                    publishedComponents: 0,
                    savedIds: 0,
                    settings: 0,
                },
            },
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Top users retrieved successfully",
            data: users,
        });
    } catch (error) {
        console.error("Get top users error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getUserStats: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not authenticated",
            });
        }

        const now = new Date();
        const start30Days = new Date(now);
        start30Days.setDate(now.getDate() - 29);
        start30Days.setHours(0, 0, 0, 0);

        const userObjectId = new mongoose.Types.ObjectId(userId);

        const [totalPosts, userInfo, savesAggregation] = await Promise.all([
            Components.countDocuments({
                authorId: userId,
                status: ComponentStatus.Published,
            }),

            Users.findById(userId).select("points savedIds").lean(),
            Components.aggregate([
                {
                    $match: {
                        authorId: userObjectId,
                        status: ComponentStatus.Published,
                        createdAt: { $gte: start30Days, $lte: now },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                        },
                        favorites: { $sum: "$saves" },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const savesByDate = new Map<string, number>(savesAggregation.map((item: { _id: string; favorites: number }) => [item._id, item.favorites] as [string, number]));

        const favoriteTrend = Array.from({ length: 6 }, (_, i) => {
            const dayOffset = 25 - i * 5;

            const blockStart = new Date(now);
            blockStart.setDate(now.getDate() - dayOffset - 4);
            blockStart.setHours(0, 0, 0, 0);

            const blockEnd = new Date(now);
            blockEnd.setDate(now.getDate() - dayOffset);
            blockEnd.setHours(23, 59, 59, 999);

            const label = blockEnd.toISOString().split("T")[0] as string;

            let total = 0;
            for (let d = 0; d < 5; d++) {
                const day = new Date(blockEnd);
                day.setDate(blockEnd.getDate() - d);
                const key = day.toISOString().split("T")[0] as string;
                total += savesByDate.get(key) ?? 0;
            }

            return { date: label, favorites: total };
        });

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "User stats retrieved successfully",
            data: {
                totalPosts,
                totalFavorites: userInfo?.savedIds?.length ?? 0,
                score: userInfo?.points ?? 0,
                favoriteTrend,
            },
        });
    } catch (error) {
        console.error("Get user stats error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};
export { updateUser, deleteUser, updateEmailSettings, getUserById, getTopUsers, getUserStats };
