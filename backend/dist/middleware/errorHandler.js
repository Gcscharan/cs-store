"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = exports.errorHandler = void 0;
const errorHandler = (error, req, res, next) => {
    let { statusCode = 500, message } = error;
    if (error.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";
    }
    else if (error.name === "CastError") {
        statusCode = 400;
        message = "Invalid ID format";
    }
    else if (error.name === "MongoError" && error.code === 11000) {
        statusCode = 400;
        message = "Duplicate field value";
    }
    else if (error.message &&
        error.message.includes("Unknown authentication strategy")) {
        statusCode = 400;
        message = "Authentication strategy not configured";
    }
    if (process.env.NODE_ENV === "development") {
        console.error("Error:", error);
    }
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
};
exports.errorHandler = errorHandler;
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};
exports.createError = createError;
//# sourceMappingURL=errorHandler.js.map