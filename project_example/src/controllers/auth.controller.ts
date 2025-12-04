import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/db.js";
import { signToken } from "../utils/jwt.js";
import { AppError } from "../middleware/error-handler.js";

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                throw new AppError("Email and password are required", 400);
            }

            if (password.length < 6) {
                throw new AppError("Password must be at least 6 characters", 400);
            }

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                throw new AppError("User already exists", 409);
            }

            const hashed = await bcrypt.hash(password, 10);

            const user = await prisma.user.create({
                data: { email, password: hashed },
                select: { id: true, email: true, createdAt: true },
            });

            return res.status(201).json({
                success: true,
                message: "User registered successfully",
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                throw new AppError("Email and password are required", 400);
            }

            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                throw new AppError("Invalid email or password", 401);
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                throw new AppError("Invalid email or password", 401);
            }

            const token = signToken({ id: user.id, email: user.email });

            return res.json({
                success: true,
                message: "Login successful",
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                    },
                },
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const header = req.headers.authorization;
            if (!header || !header.startsWith("Bearer ")) {
                throw new AppError("No token provided", 401);
            }

            const token = header.split(" ")[1];
            if (!token) {
                throw new AppError("Invalid token format", 401);
            }

            await prisma.tokenBlacklist.upsert({
                where: { token },
                update: {},
                create: { token },
            });

            return res.json({
                success: true,
                message: "Logged out successfully",
            });
        } catch (error) {
            next(error);
        }
    }
}
