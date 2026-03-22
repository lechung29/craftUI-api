/** @format */

import express from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
    createComponent,
    deleteComponent,
    getAllTags,
    getComponentById,
    getComponentListByType,
    getDraftComponents,
    getFavoriteComponents,
    getHomeStatsInfo,
    getLatestComponents,
    getTopCreators,
    getTopViewedComponentsThisWeek,
    getUserComponentList,
    getUserPublishedCount,
    getWeeklyComponentCount,
    saveAsFavorite,
} from "../controllers/components/componenController.js";

const componentRouter = express.Router();

componentRouter.get("/stats", getHomeStatsInfo);
componentRouter.get("/tags", getAllTags);
componentRouter.get("/top-creators", getTopCreators);
componentRouter.get("/latest", getLatestComponents);
componentRouter.get("/list", getComponentListByType);
componentRouter.get("/weekly/count", getWeeklyComponentCount);
componentRouter.get("/weekly/highlight", getTopViewedComponentsThisWeek);
componentRouter.get("/my-components", getUserComponentList);
componentRouter.get("/:id", getComponentById);
componentRouter.post("/:id/favorite", verifyToken, saveAsFavorite);
componentRouter.get("/:userId/favorite", verifyToken, getFavoriteComponents);
componentRouter.get("/draft", verifyToken, getDraftComponents);
componentRouter.get("/published/count", getUserPublishedCount);
componentRouter.post("/", verifyToken, createComponent);
componentRouter.delete("/:id", verifyToken, deleteComponent);

export default componentRouter;
