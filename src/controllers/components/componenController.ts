/** @format */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.js";
import Components, { ComponentStatus, ComponentStyle, ComponentType, type IComponentDocument } from "../../models/components/componentsModel.js";
import Users, { IResponseStatus, IUserStatus } from "../../models/users/usersModel.js";
import mongoose from "mongoose";
import { toObjectId } from "../comments/commentControler.js";
import Comments from "../../models/comments/commentsModel.js";

const createComponent: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { html, css, type, style, tags, isDraft, componentId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not authenticated",
            });
        }

        if (!html || !type || !style) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Missing required fields: html, type, and style are required",
            });
        }

        if (!Object.values(ComponentType).includes(type)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid component type",
            });
        }

        if (!Object.values(ComponentStyle).includes(style)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid component style",
            });
        }

        const status = isDraft ? ComponentStatus.Draft : ComponentStatus.Published;

        const componentData: Partial<IComponentDocument> = {
            code: { html, css: css || "" },
            type,
            style,
            status,
            tags: tags || [],
            authorId: userId,
        };
        const author = await Users.findById(userId);

        if (componentId) {
            if (!mongoose.Types.ObjectId.isValid(componentId)) {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Invalid component ID format",
                });
            }

            const existing = await Components.findOne({ _id: componentId, authorId: userId });
            if (!existing) {
                return res.status(404).send({
                    status: IResponseStatus.Error,
                    message: "Draft not found or you don't have permission to edit it",
                });
            }

            await Components.findByIdAndUpdate(componentId, componentData, { new: true });

            let updatedPoints: number | undefined = author?.points ?? 0;
            if (status === ComponentStatus.Published) {
                const updatedAuthor = await Users.findByIdAndUpdate(userId, { $inc: { points: 50 } }, { new: true });
                updatedPoints = updatedAuthor?.points;
            }

            return res.status(200).send({
                status: IResponseStatus.Success,
                message: isDraft ? "Draft saved successfully" : "Component published successfully",
                data: {
                    requesterPoint: updatedPoints,
                },
            });
        }

        if (!author) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "User with this ID does not exist",
            });
        }

        const component = new Components(componentData);
        await component.save();

        let updatedPoints: number | undefined = author?.points ?? 0;
        if (status === ComponentStatus.Published) {
            const updatedAuthor = await Users.findByIdAndUpdate(userId, { $inc: { points: 50 } }, { new: true });
            updatedPoints = updatedAuthor?.points;
        }

        return res.status(201).send({
            status: IResponseStatus.Success,
            message: isDraft ? "Draft saved successfully" : "Component published successfully",
            data: {
                requesterPoint: updatedPoints,
            },
        });
    } catch (error: any) {
        console.error("Component creation error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getComponentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { requesterId } = req.query;
        if (!mongoose.Types.ObjectId.isValid(id ?? "")) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid component ID format",
            });
        }
        const componentById = await Components.findById(id).populate("authorId", "username email avatar");
        if (!componentById || (componentById.status === ComponentStatus.Draft && !componentById.authorId._id.equals(requesterId as string))) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "Component not found",
            });
        }

        if (componentById.status === ComponentStatus.Draft && componentById.authorId._id.equals(requesterId as string)) {
            return res.status(200).send({
                status: IResponseStatus.Success,
                message: "Component retrieved successfully",
                data: {
                    _id: componentById._id,
                    type: componentById.type,
                    style: componentById.style,
                    code: componentById.code,
                    tags: componentById.tags,
                    thumbnail: componentById.thumbnail,
                    status: componentById.status,
                    views: componentById.views,
                    saves: componentById.saves,
                    authorId: componentById.authorId,
                    createdAt: componentById.createdAt,
                    updatedAt: componentById.updatedAt,
                },
            });
        }
        await componentById.updateOne({ $inc: { views: 1 } }, { new: true });
        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Component retrieved successfully",
            data: {
                _id: componentById._id,
                type: componentById.type,
                style: componentById.style,
                code: componentById.code,
                tags: componentById.tags,
                thumbnail: componentById.thumbnail,
                status: componentById.status,
                views: componentById.views,
                saves: componentById.saves,
                authorId: componentById.authorId,
                createdAt: componentById.createdAt,
                updatedAt: componentById.updatedAt,
            },
        });
    } catch (error: any) {
        console.error("Get component error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getLatestComponents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit = 8 } = req.query;

        const limitNum = Math.min(100, Math.max(1, Number(limit)));

        const components = await Components.find({
            status: ComponentStatus.Published,
        })
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .populate("authorId", "username avatar")
            .select("type style code tags thumbnail status views saves likes createdAt updatedAt")
            .lean();

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Latest components retrieved successfully",
            data: components,
        });
    } catch (error: any) {
        console.error("Get latest components error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const saveAsFavorite: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not authenticated",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id ?? "")) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid component ID format",
            });
        }

        const userInfo = await Users.findById(userId);
        if (!userInfo) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "User is not existed",
            });
        }

        const componentObjectId = new mongoose.Types.ObjectId(id);
        const alreadySaved = userInfo.savedIds?.some((savedId) => savedId.equals(componentObjectId));

        const component = await Components.findById(id).select("authorId").lean();
        if (!component) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "Component not found",
            });
        }

        const pointsDelta = alreadySaved ? -10 : 10;
        const isOwnComponent = component.authorId.toString() === userId.toString();

        const [updatedUser] = await Promise.all([
            Users.findByIdAndUpdate(userId, alreadySaved ? { $pull: { savedIds: componentObjectId } } : { $addToSet: { savedIds: componentObjectId } }, { new: true }),
            Components.findByIdAndUpdate(componentObjectId, { $inc: { saves: alreadySaved ? -1 : 1 } }, { new: true }),
            !isOwnComponent ? Users.findByIdAndUpdate(component.authorId, { $inc: { points: pointsDelta } }) : Promise.resolve(),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: alreadySaved ? "Removed from favorites" : "Added to favorites",
            data: {
                isFavorite: !alreadySaved,
                savedIds: updatedUser?.savedIds,
            },
        });
    } catch (error) {
        console.error("Save component error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getFavoriteComponents: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not authenticated",
            });
        }

        const userInfo = await Users.findById(userId).select("savedIds").lean();

        if (!userInfo) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "User not found",
            });
        }

        if (!userInfo.savedIds || userInfo.savedIds.length === 0) {
            return res.status(200).send({
                status: IResponseStatus.Success,
                message: "No favorite components found",
                data: [],
            });
        }

        const { page = 1, limit = 12 } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [components, total] = await Promise.all([
            Components.find({
                _id: { $in: userInfo.savedIds },
                status: ComponentStatus.Published,
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate("authorId", "username avatar")
                .select("type style code tags thumbnail status views saves createdAt updatedAt")
                .lean(),

            Components.countDocuments({
                _id: { $in: userInfo.savedIds },
                status: ComponentStatus.Published,
            }),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Favorite components retrieved successfully",
            data: {
                components,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        console.error("Get favorite components error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getComponentListByType: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 12, type, style, search } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        let queryObject: any = {
            status: ComponentStatus.Published,
        };

        if (type !== "undefined") {
            queryObject.type = type;
        }
        if (style !== "undefined") {
            queryObject.style = style;
        }

        if (search && typeof search === "string" && search.trim()) {
            const keyword = search.trim();

            const matchedAuthors = await Users.find({
                username: { $regex: keyword, $options: "i" },
            })
                .select("_id")
                .lean();

            const authorIds = matchedAuthors.map((u) => u._id);
            queryObject.$or = [...(authorIds.length > 0 ? [{ authorId: { $in: authorIds } }] : []), { tags: { $regex: keyword, $options: "i" } }];
        }

        const [components, total] = await Promise.all([
            Components.find(queryObject)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate("authorId", "username avatar")
                .select("type style code tags thumbnail status views saves createdAt updatedAt")
                .lean(),

            Components.countDocuments(queryObject),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Components list retrieved successfully",
            data: {
                components,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        console.error("Get components error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getDraftComponents: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not authenticated",
            });
        }

        const { page = 1, limit = 12 } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [components, total] = await Promise.all([
            Components.find({
                authorId: userId,
                status: ComponentStatus.Draft,
            })
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .select("type style code tags thumbnail status views saves createdAt updatedAt")
                .lean(),

            Components.countDocuments({
                authorId: userId,
                status: ComponentStatus.Draft,
            }),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Draft components retrieved successfully",
            data: components,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("Get draft components error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getHomeStatsInfo: RequestHandler = async (req: Request, res: Response) => {
    try {
        const [componentsCount, usersCount] = await Promise.all([Components.countDocuments({ status: ComponentStatus.Published }), Users.countDocuments({ status: IUserStatus.Activated })]);
        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Get stats info successfully",
            data: {
                elementsCount: componentsCount,
                contributorsCount: usersCount,
            },
        });
    } catch (error) {
        console.error("Get stats information error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getAllTags: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const [tags, highlightTags] = await Promise.all([
            Components.distinct("tags", { status: ComponentStatus.Published }),
            Components.aggregate([
                { $match: { status: ComponentStatus.Published } },
                { $unwind: "$tags" },
                { $group: { _id: "$tags", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $project: { _id: 0, tag: "$_id" } },
            ]).then((res) => res.map((item) => item.tag)),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Tags retrieved successfully",
            data: { tags, highlightTags },
        });
    } catch (error) {
        console.error("Get all tags error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getTopCreators: RequestHandler = async (req: Request, res: Response) => {
    try {
        const topCreators = await Users.find({ status: IUserStatus.Activated }).sort({ points: -1 }).limit(30).select("username avatar points").lean();

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Top creators retrieved successfully",
            data: topCreators,
        });
    } catch (error) {
        console.error("Get top creators error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getUserComponentList: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 12, status, type, sort = "default", userId } = req.query;

        if (!userId || userId === "undefined") {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not found",
            });
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const queryObject: any = { authorId: userId };

        if (status === "2") {
            queryObject.status = ComponentStatus.Published;
        } else if (status === "1") {
            queryObject.status = ComponentStatus.Draft;
        } else {
            queryObject.status = { $in: [ComponentStatus.Published, ComponentStatus.Draft] };
        }

        if (type && type !== "undefined") {
            queryObject.type = type;
        }

        const sortObject: any = sort === "most_viewed" ? { views: -1 } : sort === "most_saved" ? { saves: -1 } : { createdAt: -1 };

        const [components, total] = await Promise.all([
            Components.find(queryObject)
                .sort(sortObject)
                .skip(skip)
                .limit(limitNum)
                .populate("authorId", "username avatar")
                .select("type style code tags thumbnail status views saves createdAt updatedAt")
                .lean(),
            Components.countDocuments(queryObject),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "User components retrieved successfully",
            data: {
                components,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        console.error("Get user components error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const deleteComponent: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not authenticated",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id ?? "")) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid component ID format",
            });
        }

        const component = await Components.findOne({ _id: id, authorId: userId });
        if (!component) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "Component not found or you don't have permission to delete it",
            });
        }

        const componentObjectId = toObjectId(id!);

        const externalCommentCount = await Comments.countDocuments({
            componentId: componentObjectId,
            authorId: { $ne: toObjectId(userId) },
            isDeleted: false,
        });

        const publishedPenalty = component.status === ComponentStatus.Published ? -50 : 0;
        const savePenalty = -(component.saves || 0) * 10;
        const commentPenalty = -externalCommentCount * 2;
        const totalPenalty = publishedPenalty + savePenalty + commentPenalty;

        await Promise.all([
            Components.findByIdAndDelete(id),
            Comments.deleteMany({ componentId: componentObjectId }),
            Users.updateMany({ savedIds: id }, { $pull: { savedIds: componentObjectId } }),
            totalPenalty !== 0 ? Users.findByIdAndUpdate(userId, { $inc: { points: totalPenalty } }) : Promise.resolve(),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Component deleted successfully",
        });
    } catch (error) {
        console.error("Delete component error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getUserPublishedCount: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId || userId === "undefined") {
            return res.status(401).send({
                status: IResponseStatus.Error,
                message: "User not found",
            });
        }

        const [count, userInfo] = await Promise.all([
            Components.countDocuments({
                authorId: userId,
                status: ComponentStatus.Published,
            }),
            Users.findById(userId),
        ]);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Published count retrieved successfully",
            data: {
                count,
                points: userInfo?.points,
            },
        });
    } catch (error) {
        console.error("Get published count error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getTopViewedComponentsThisWeek: RequestHandler = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const components = await Components.find({
            status: ComponentStatus.Published,
            createdAt: { $gte: startOfWeek },
        })
            .sort({ views: -1 })
            .limit(9)
            .populate("authorId", "username avatar")
            .select("type style code tags thumbnail status views saves createdAt updatedAt")
            .lean();

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Top viewed components this week retrieved successfully",
            data: components,
        });
    } catch (error) {
        console.error("Get top viewed components this week error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

const getWeeklyComponentCount: RequestHandler = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const count = await Components.countDocuments({
            status: ComponentStatus.Published,
            createdAt: { $gte: startOfWeek },
        });

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Weekly component count retrieved successfully",
            data: count,
        });
    } catch (error) {
        console.error("Get weekly component count error:", error);
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: "A system error occurred. Please try again later",
        });
    }
};

export {
    createComponent,
    getComponentById,
    getLatestComponents,
    saveAsFavorite,
    getFavoriteComponents,
    getDraftComponents,
    getHomeStatsInfo,
    getComponentListByType,
    getAllTags,
    getTopCreators,
    getUserComponentList,
    deleteComponent,
    getUserPublishedCount,
    getTopViewedComponentsThisWeek,
    getWeeklyComponentCount,
};
