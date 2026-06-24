import { Router } from "express";

import {
    createTask,
    getTasks,
    updateStatus,
    searchTask,
    generateSummary
}
    from "../controllers/task.controller";


import { authMiddleware }
    from "../middleware/auth.middleware";


const router = Router();
router.use(authMiddleware);
router.post("/", createTask);
router.get("/", getTasks);
router.put(
    "/:id/status",
    updateStatus
);
router.get("/search", searchTask);
router.post("/:id/summary", generateSummary);

export default router;