import { Request, Response } from "express";
export declare const getStats: (req: Request, res: Response) => Promise<void>;
export declare const getAdminProfile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getUsers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAdminProducts: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAdminOrders: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getAdminDeliveryBoys: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const exportOrders: (req: Request, res: Response) => Promise<void>;
export declare const getDashboardStats: (req: Request, res: Response) => Promise<Response | void>;
export declare const updateProduct: (req: Request, res: Response) => Promise<Response | void>;
export declare const deleteProduct: (req: Request, res: Response) => Promise<Response | void>;
export declare const makeDeliveryBoy: (req: Request, res: Response) => Promise<Response | void>;
//# sourceMappingURL=adminController.d.ts.map