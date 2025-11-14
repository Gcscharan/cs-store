import { Request, Response, NextFunction } from "express";
interface ExtendedRequest extends Request {
    verifiedPayment?: any;
}
export declare const createRateLimit: (windowMs: number, max: number, message?: string) => import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const apiRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const paymentRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const verifyRazorpaySignature: (req: ExtendedRequest, res: Response, next: NextFunction) => Response | void;
export declare const validateInput: (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const userValidationRules: import("express-validator").ValidationChain[];
export declare const addressValidationRules: import("express-validator").ValidationChain[];
export declare const productValidationRules: import("express-validator").ValidationChain[];
export declare const securityLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestSizeLimit: (limit?: string) => (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
    credentials: boolean;
    optionsSuccessStatus: number;
};
declare const _default: {
    createRateLimit: (windowMs: number, max: number, message?: string) => import("express-rate-limit").RateLimitRequestHandler;
    authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    apiRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    paymentRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
    sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
    verifyRazorpaySignature: (req: ExtendedRequest, res: Response, next: NextFunction) => Response | void;
    validateInput: (req: Request, res: Response, next: NextFunction) => Response | void;
    userValidationRules: import("express-validator").ValidationChain[];
    addressValidationRules: import("express-validator").ValidationChain[];
    productValidationRules: import("express-validator").ValidationChain[];
    securityLogger: (req: Request, res: Response, next: NextFunction) => void;
    requestSizeLimit: (limit?: string) => (req: Request, res: Response, next: NextFunction) => Response | void;
    corsOptions: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
        credentials: boolean;
        optionsSuccessStatus: number;
    };
};
export default _default;
//# sourceMappingURL=security.d.ts.map