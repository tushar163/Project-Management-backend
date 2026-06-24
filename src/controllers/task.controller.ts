import { Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../utils/prisma";

// CREATE TASK
export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, projectId, assignedToId, priority } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: "Title is required" });
        }

        if (!projectId) {
            return res.status(400).json({ message: "projectId is required" });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true },
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (project.ownerId !== req.user.id) {
            return res.status(403).json({ message: "You don't own this project" });
        }

        // if assigning to someone, check that user actually exists
        if (assignedToId) {
            const assignee = await prisma.user.findUnique({
                where: { id: assignedToId },
                select: { id: true },
            });

            if (!assignee) {
                return res.status(400).json({ message: "assignedToId is not a valid user" });
            }
        }

        const task = await prisma.task.create({
            data: {
                title: title.trim(),
                description: description ?? null,
                projectId,
                assignedToId: assignedToId ?? null,
                createdById: req.user.id,
                priority: priority ?? undefined, // let schema default (MEDIUM) kick in if not sent
            },
        });

        return res.status(201).json({ data: task, message: "Task created Successfully", success: true });
    } catch (error) {
        console.error("createTask error:", error);
        return res.status(500).json({ message: "Failed to create task", success: false });
    }
};

// GET TASKS
export const getTasks = async (req: AuthRequest, res: Response) => {
    try {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
        const skip = (page - 1) * limit;

        const status = req.query.status as string | undefined;
        const priority = req.query.priority as string | undefined;
        const projectId = req.query.projectId as string | undefined;

        // typing this explicitly as Prisma.TaskWhereInput stops TS from
        // inferring a narrower literal type that later fights with findMany()
        const where: Prisma.TaskWhereInput = {
            OR: [{ createdById: req.user.id }, { assignedToId: req.user.id }],
            ...(status && { status: status as any }),
            ...(priority && { priority: priority as any }),
            ...(projectId && { projectId }),
        };

        const [tasks, total] = await prisma.$transaction([
            prisma.task.findMany({
                where,
                include: {
                    project: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.task.count({ where }),
        ]);

        return res.status(200).json({
            data: tasks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("getTasks error:", error);
        return res.status(500).json({ message: "Failed to fetch tasks" });
    }
};

// UPDATE STATUS
export const updateStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { status } = req.body;
        const validStatuses = ["TODO", "IN_PROGRESS", "DONE"];
        const taskId = req.params.id as string; // route param, always a single string here

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                message: `status must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { createdById: true, assignedToId: true },
        });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const isAllowed = task.createdById === req.user.id || task.assignedToId === req.user.id;

        if (!isAllowed) {
            return res.status(403).json({ message: "You can't update this task" });
        }

        const updated = await prisma.task.update({
            where: { id: taskId },
            data: { status },
        });

        return res.status(200).json({ data: updated, message: "Task updated successfully", success: true });
    } catch (error) {
        console.error("updateStatus error:", error);
        return res.status(500).json({ message: "Failed to update status" });
    }
};

// SEARCH TASK
export const searchTask = async (req: AuthRequest, res: Response) => {
    try {
        const q = (req.query.q as string)?.trim();

        if (!q) {
            return res.status(400).json({ message: "Search query 'q' is required" });
        }

        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
        const skip = (page - 1) * limit;

        // explicit type here too — "insensitive" as a plain string was getting
        // inferred as `string` instead of Prisma's QueryMode enum, which is
        // what caused the big nested AND/OR error
        const where: Prisma.TaskWhereInput = {
            AND: [
                { OR: [{ createdById: req.user.id }, { assignedToId: req.user.id }] },
                {
                    OR: [
                        { title: { contains: q, mode: "insensitive" } },
                        { description: { contains: q, mode: "insensitive" } },
                    ],
                },
            ],
        };

        const [tasks, total] = await prisma.$transaction([
            prisma.task.findMany({
                where,
                include: {
                    project: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.task.count({ where }),
        ]);

        return res.status(200).json({
            data: tasks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("searchTask error:", error);
        return res.status(500).json({ message: "Search failed" });
    }
};

// AI SUMMARY
export const generateSummary = async (req: AuthRequest, res: Response) => {
    try {
        const taskId = req.params.id as string;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        if (task.createdById !== req.user.id && task.assignedToId !== req.user.id) {
            return res.status(403).json({ message: "You don't have access to this task" });
        }

        let summary: string;

        try {
            summary = await callAiForSummary(task.title, task.description);
        } catch (aiError) {
            console.error("AI summary generation failed, using fallback:", aiError);
            summary = `Task "${task.title}" is currently ${task.status.replace("_", " ").toLowerCase()} with ${task.priority.toLowerCase()} priority.`;
        }

        const updated = await prisma.task.update({
            where: { id: taskId },
            data: { aiSummary: summary },
        });

        return res.status(200).json({ data: updated, message: "Summary generated successfully", success: true });
    } catch (error) {
        console.error("generateSummary error:", error);
        return res.status(500).json({ message: "Failed to generate summary" });
    }
};

// small helper, calls Gemini to get a one-liner summary of the task
// using gemini-1.5-flash since 2.0-flash is shut down as of June 2026,
// swap GEMINI_MODEL in .env if you want to try a newer one later
async function callAiForSummary(title: string, description: string | null): Promise<string> {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("Gemini API key missing");
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: "POST",
            headers: {
                "x-goog-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Summarize this task in one short sentence for a project dashboard.\n\nTitle: ${title}\nDescription: ${description ?? "No description provided"}`,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    maxOutputTokens: 100,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API returned ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Gemini response had no text content");
    }

    return text.trim();
}