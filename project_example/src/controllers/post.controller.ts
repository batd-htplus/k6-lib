import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db.js";
import { AppError } from "../middleware/error-handler.js";

export class PostController {
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const { title, content } = req.body;

            if (!title) {
                throw new AppError("Title is required", 400);
            }

            const post = await prisma.post.create({
                data: {
                    title,
                    content: content || "",
                    authorId: userId,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
            });

            return res.status(201).json({
                success: true,
                message: "Post created successfully",
                data: post,
            });
        } catch (error) {
            next(error);
        }
    }

    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const posts = await prisma.post.findMany({
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            });

            return res.json({
                success: true,
                data: posts,
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;
            const { title, content } = req.body;

            const post = await prisma.post.findUnique({
                where: { id: Number(id) },
            });

            if (!post) {
                throw new AppError("Post not found", 404);
            }

            if (post.authorId !== userId) {
                throw new AppError("You don't have permission to update this post", 403);
            }

            const updatedPost = await prisma.post.update({
                where: { id: Number(id) },
                data: {
                    ...(title && { title }),
                    ...(content !== undefined && { content }),
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
            });

            return res.json({
                success: true,
                message: "Post updated successfully",
                data: updatedPost,
            });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            // Find post
            const post = await prisma.post.findUnique({
                where: { id: Number(id) },
            });

            if (!post) {
                throw new AppError("Post not found", 404);
            }

            // Check ownership
            if (post.authorId !== userId) {
                throw new AppError("You don't have permission to delete this post", 403);
            }

            // Delete post
            await prisma.post.delete({ where: { id: Number(id) } });

            return res.json({
                success: true,
                message: "Post deleted successfully",
            });
        } catch (error) {
            next(error);
        }
    }
}
