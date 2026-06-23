import { Router } from "express";
import {
    createProject,
    getProjects,
    updateProject,
    deleteProject
}
    from "../controllers/project.controller";

import { authMiddleware }
    from "../middleware/auth.middleware";


const router = Router();


router.use(authMiddleware);


router.post("/", createProject);

router.get("/", getProjects);

router.put("/:id", updateProject);

router.delete("/:id", deleteProject);



export default router;