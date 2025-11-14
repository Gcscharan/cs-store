import { Request, Response } from "express";
export declare const generatePaymentOTP: (req: Request, res: Response) => Promise<void>;
export declare const verifyPaymentOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const resendPaymentOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=otpController.d.ts.map