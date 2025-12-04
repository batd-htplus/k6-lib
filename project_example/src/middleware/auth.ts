import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db.js";
import { verifyToken } from "../utils/jwt.js";
import { AppError } from "./error-handler.js";

export async function auth(req: Request, res: Response, next: NextFunction) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
            throw new AppError("No token provided", 401);
        }

        const token = header.split(" ")[1];
        if (!token) {
            throw new AppError("No token provided", 401);
        }

        const blacklisted = await prisma.tokenBlacklist.findUnique({
            where: { token },
        });
        if (blacklisted) {
            throw new AppError("Token has been revoked", 401);
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError("Invalid or expired token", 401));
    }
}
