/** @format */

import mongoose, { Document, Types } from "mongoose";

export enum ComponentType {
    Button = 1,
    Switch,
    Checkbox,
    Card,
    Loader,
    Input,
    Form,
    Radio,
    Tooltip,
}

export enum ComponentStyle {
    CSS = "css",
    Tailwind = "tailwind",
}

export enum ComponentStatus {
    Draft = 1,
    Published,
}

export interface IComponentCode {
    html: string;
    css: string;
}

export interface IComponentBase {
    type: ComponentType;
    style: ComponentStyle;
    code: IComponentCode;
    tags?: string[];
    thumbnail?: string;
}

export interface IComponent extends IComponentBase {
    authorId: string;
    status: ComponentStatus;
    views: number;
    saves: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IComponentDocument extends Omit<IComponent, "authorId">, Document {
    authorId: Types.ObjectId;
}

const componentSchema = new mongoose.Schema<IComponentDocument>(
    {
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        type: {
            type: Number,
            required: true,
        },
        style: {
            type: String,
            required: true,
        },
        code: {
            html: {
                type: String,
                required: true,
            },
            css: {
                type: String,
                default: "",
            },
        },
        views: {
            type: Number,
            default: 0,
        },
        saves: {
            type: Number,
            default: 0,
        },
        status: {
            type: Number,
            default: ComponentStatus.Draft,
        },
        tags: {
            type: [String],
            default: [],
        },
        thumbnail: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

const Components = mongoose.model<IComponentDocument>("Components", componentSchema);

export default Components;
