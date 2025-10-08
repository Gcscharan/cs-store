import { Request, Response } from "express";
export declare const getAvailableDrivers: (req: Request, res: Response) => Promise<void>;
export declare const assignDelivery: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateLocation: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyOrders: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=deliveryController.d.ts.map