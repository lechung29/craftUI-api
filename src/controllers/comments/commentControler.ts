/** @format */

import type { Request, Response } from "express";
import mongoose from "mongoose";
import Comments from "../../models/comments/commentsModel.js";
import Users, { IResponseStatus } from "../../models/users/usersModel.js";
import Components from "../../models/components/componentsModel.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.js";

export const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const attachUserVote = (comments: any[], userId?: string) => {
    if (!userId) return comments;
    return comments.map((c) => {
        const voter = c.voters?.find((v: any) => v.userId.toString() === userId);
        const { voters, ...rest } = c;
        return { ...rest, userVote: voter?.value ?? null };
    });
};

const getComments = async (req: Request, res: Response) => {
    try {
        const { componentId } = req.params;
        const { userId } = req.query;

        if (!mongoose.Types.ObjectId.isValid(componentId as string)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid componentId",
            });
        }

        const allComments = await Comments.find({
            componentId: toObjectId(componentId!),
            isDeleted: false,
        })
            .populate("authorId", "username avatar")
            .sort({ createdAt: -1 })
            .lean();

        const topLevel = allComments.filter((c) => !c.parentId);
        const replies = allComments.filter((c) => !!c.parentId);

        const nested = topLevel.map((comment) => {
            const commentReplies = replies.filter((r) => r.parentId?.toString() === comment._id.toString());
            return { ...comment, replies: attachUserVote(commentReplies, userId as string) };
        });

        const withVotes = attachUserVote(nested, userId as string);

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Comments fetched.",
            data: {
                comments: withVotes,
                total: topLevel.length,
            },
        });
    } catch (err: any) {
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: err.message || "Failed to fetch comments.",
        });
    }
};

const addComment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const authorId = req.user?.id;
        const { componentId, content, parentId } = req.body;

        if (!componentId || !content?.trim()) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "componentId and content are required.",
            });
        }

        if (content.trim().length > 2000) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Comment must not exceed 2000 characters.",
            });
        }

        if (parentId) {
            const parent = await Comments.findById(parentId);
            if (!parent || parent.isDeleted) {
                return res.status(404).send({
                    status: IResponseStatus.Error,
                    message: "Parent comment not found.",
                });
            }
            if (parent.parentId) {
                return res.status(400).send({
                    status: IResponseStatus.Error,
                    message: "Replies can only be one level deep.",
                });
            }
        }

        const component = await Components.findById(componentId).select("authorId").lean();
        const isOwnComponent = component?.authorId.toString() === authorId?.toString();

        const comment = await Comments.create({
            componentId: toObjectId(componentId),
            authorId: toObjectId(authorId),
            content: content.trim(),
            parentId: parentId ? toObjectId(parentId) : null,
        });

        const populated = await comment.populate("authorId", "username avatar");
        const { voters, ...rest } = (populated as any).toObject();

        if (component && !isOwnComponent) {
            await Users.findByIdAndUpdate(component.authorId, { $inc: { points: 2 } });
        }

        return res.status(201).send({
            status: IResponseStatus.Success,
            message: "Comment added.",
            data: { ...rest, replies: [], userVote: null },
        });
    } catch (err: any) {
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: err.message || "Failed to add comment.",
        });
    }
};

const voteComment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { commentId } = req.params;
        const { value } = req.body;

        if (![1, -1].includes(value)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Value must be 1 or -1.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(commentId!)) {
            return res.status(400).send({
                status: IResponseStatus.Error,
                message: "Invalid commentId.",
            });
        }

        const comment = await Comments.findById(commentId);
        if (!comment || comment.isDeleted) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "Comment not found.",
            });
        }

        const existingVoterIndex = comment.voters.findIndex((v) => v.userId.toString() === userId.toString());

        if (existingVoterIndex !== -1) {
            const existing = comment.voters[existingVoterIndex];

            if (existing?.value === value) {
                comment.votes -= value;
                comment.voters.splice(existingVoterIndex, 1);
            } else {
                comment.votes += value * 2;
                comment.voters[existingVoterIndex]!.value = value;
            }
        } else {
            comment.votes += value;
            comment.voters.push({ userId: toObjectId(userId), value });
        }

        await comment.save();

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Vote recorded.",
            data: { votes: comment.votes },
        });
    } catch (err: any) {
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: err.message || "Failed to vote.",
        });
    }
};

const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { commentId } = req.params;

        const comment = await Comments.findById(commentId);
        if (!comment || comment.isDeleted) {
            return res.status(404).send({
                status: IResponseStatus.Error,
                message: "Comment not found.",
            });
        }

        if (comment.authorId.toString() !== userId.toString()) {
            return res.status(403).send({
                status: IResponseStatus.Error,
                message: "You are not allowed to delete this comment.",
            });
        }

        const component = await Components.findById(comment.componentId).select("authorId").lean();
        const isOwnComment = component?.authorId.toString() === comment.authorId.toString();

        comment.isDeleted = true;
        comment.content = "[deleted]";
        await comment.save();

        if (component && !isOwnComment) {
            await Users.findByIdAndUpdate(component.authorId, { $inc: { points: -2 } });
        }

        return res.status(200).send({
            status: IResponseStatus.Success,
            message: "Comment deleted.",
        });
    } catch (err: any) {
        return res.status(500).send({
            status: IResponseStatus.Error,
            message: err.message || "Failed to delete comment.",
        });
    }
};

export { deleteComment, addComment, getComments, voteComment };
