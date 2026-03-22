/** @format */

import mongoose, { Document } from "mongoose";

export enum IResponseStatus {
    Error = 0,
    Success = 1,
}

export enum IUserStatus {
    Activated = 1,
    Deleted,
}

export type IUserInfo = Omit<IUserData, "password">;

export interface IUserSettings {
    isReceiveEmailNotification?: boolean;
}

export interface IUserData extends Document {
    username: string;
    email: string;
    password: string;
    avatar: string;
    thumbnail: string;
    location: string;
    company: string;
    twitter: string;
    websiteURL: string;
    biography: string;
    status: IUserStatus;
    settings: IUserSettings;
    createdAt: Date;
    updatedAt: Date;
    refreshToken: string[];
    points: number;
    savedIds: mongoose.Types.ObjectId[];
}

export const defaultAvatar: string = "https://www.pngkey.com/png/full/115-1150420_avatar-png-pic-male-avatar-icon-png.png";

const userSchema = new mongoose.Schema<IUserData>(
    {
        username: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        location: {
            type: String,
            required: false,
        },
        avatar: {
            type: String,
            required: false,
            default: defaultAvatar,
        },
        thumbnail: {
            type: String,
            required: false,
            default: "",
        },
        company: {
            type: String,
            required: false,
            default: "",
        },
        twitter: {
            type: String,
            required: false,
            default: "",
        },
        websiteURL: {
            type: String,
            required: false,
            default: "",
        },
        status: {
            type: Number,
            required: false,
            enum: IUserStatus,
            default: IUserStatus.Activated,
        },
        biography: {
            type: String,
            required: false,
            default: "",
        },
        savedIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Components",
                default: [],
            },
        ],
        points: {
            type: Number,
            required: false,
            default: 0,
        },
        settings: {
            type: {
                isReceiveEmailNotification: {
                    type: Boolean,
                    required: false,
                },
            },
            required: false,
            default: {
                isReceiveEmailNotification: true,
            },
        },
        refreshToken: [
            {
                type: String,
                required: false,
                default: [],
            },
        ],
    },
    { timestamps: true, minimize: false },
);

const Users = mongoose.model<IUserData>("Users", userSchema);

export default Users;
