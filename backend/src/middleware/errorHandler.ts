import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message } = error;

  // Handle specific error types
  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if (error.name === "MongoError" && (error as any).code === 11000) {
    statusCode = 400;
    message = "Duplicate field value";
  }

  // Log error in development
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", error);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

export const createError = (
  message: string,
  statusCode: number = 500
): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
