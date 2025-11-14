import { Request, Response } from "express";
export declare const createOrder: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const verifyPayment: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getPaymentDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAllPayments: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getPaymentStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const paymentCallback: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=paymentController.d.ts.map