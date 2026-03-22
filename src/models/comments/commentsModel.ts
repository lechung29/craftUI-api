/** @format */

import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICommentDocument extends Document {
    componentId: Types.ObjectId;
    authorId: Types.ObjectId;
    content: string;
    parentId?: Types.ObjectId | null;
    votes: number;
    voters: {
        userId: Types.ObjectId;
        value: 1 | -1;
    }[];
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema = new Schema<ICommentDocument>(
    {
        componentId: {
            type: Schema.Types.ObjectId,
            ref: "Components",
            required: true,
            index: true,
        },
        authorId: {
            type: Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: "Comments",
            default: null,
        },
        votes: {
            type: Number,
            default: 0,
        },
        voters: [
            {
                userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
                value: { type: Number, enum: [1, -1], required: true },
            },
        ],
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

CommentSchema.index({ componentId: 1, parentId: 1, createdAt: -1 });

const Comments = mongoose.model<ICommentDocument>("Comments", CommentSchema);

export default Comments;
