import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }

    if (err.name === "PrismaClientKnownRequestError") {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Duplicate entry",
            });
        }
        if (prismaError.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Record not found",
            });
        }
    }

    console.error("Error:", err);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
};
