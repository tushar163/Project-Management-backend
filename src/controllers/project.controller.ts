import { Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../utils/prisma";

export const createProject = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Project name is required",
            });
        }

        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                description: description ?? null,
                ownerId: req.user.id,
            },
        });

        return res.status(201).json({ data: project, message: "Project created Successfully", success: true });
    } catch (error) {
        console.error("createProject error:", error);
        return res.status(500).json({ message: "Failed to create project", success: false });
    }
}

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit as string) || 10, 1),
            100
        );
        const skip = (page - 1) * limit;

        const search = (req.query.search as string)?.trim();

        // explicit type here so "insensitive" resolves to Prisma's QueryMode
        // enum instead of being inferred as a plain string
        const where: Prisma.ProjectWhereInput = {
            ownerId: req.user.id,
            ...(search && {
                name: { contains: search, mode: "insensitive" },
            }),
        };

        const [projects, total] = await prisma.$transaction([
            prisma.project.findMany({
                where,
                include: {
                    tasks: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            priority: true,
                        },
                    },
                    _count: { select: { tasks: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.project.count({ where }),
        ],
            // { timeout: 10000 }
        );

        return res.status(200).json({
            data: projects,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: skip + limit < total,
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error("getProjects error:", error);
        return res.status(500).json({ message: "Failed to fetch projects" });
    }
}

export const getProjectById = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.params.id as string; // route param, always a single string here

        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                ownerId: req.user.id,
            },
            include: {
                tasks: {
                    include: {
                        assignedTo: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        return res.status(200).json({ data: project, success: true });
    } catch (error) {
        console.error("getProjectById error:", error);
        return res.status(500).json({ message: "Failed to fetch project" });
    }
}

export const updateProject = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;
        const projectId = req.params.id as string;

        if (name !== undefined && (typeof name !== "string" || !name.trim())) {
            return res.status(400).json({
                message: "Project name cannot be empty",
            });
        }

        const existing = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true },
        });

        if (!existing) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (existing.ownerId !== req.user.id) {
            return res.status(403).json({
                message: "You do not have permission to update this project",
            });
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(description !== undefined && { description }),
            },
        });

        return res.status(200).json({ data: project, message: "Project updated successfully", success: true });
    } catch (error) {
        console.error("updateProject error:", error);
        return res.status(500).json({ message: "Failed to update project" });
    }
}

export const deleteProject = async (req: AuthRequest, res: Response) => {
    try {
        const projectId = req.params.id as string;

        const existing = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true },
        });

        if (!existing) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (existing.ownerId !== req.user.id) {
            return res.status(403).json({
                message: "You do not have permission to delete this project",
            });
        }

        await prisma.project.delete({
            where: { id: projectId },
        });

        return res.status(204).send();
    } catch (error) {
        console.error("deleteProject error:", error);
        return res.status(500).json({ message: "Failed to delete project" });
    }
}