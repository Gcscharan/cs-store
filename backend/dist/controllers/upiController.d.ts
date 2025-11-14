import { Request, Response } from "express";
export declare const upiVerificationRateLimit: import("express-rate-limit").RateLimitRequestHandler;
interface UpiVerificationRequest {
    vpa: string;
}
interface UpiVerificationResponse {
    success: boolean;
    name?: string;
    message?: string;
}
export declare const verifyUpiId: (req: Request<{}, UpiVerificationResponse, UpiVerificationRequest>, res: Response<UpiVerificationResponse>) => Promise<void>;
export {};
//# sourceMappingURL=upiController.d.ts.map