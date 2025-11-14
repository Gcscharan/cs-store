import { Request, Response } from "express";
export declare const getCart: (req: Request, res: Response) => Promise<Response | void>;
export declare const addToCart: (req: Request, res: Response) => Promise<Response | void>;
export declare const updateCartItem: (req: Request, res: Response) => Promise<Response | void>;
export declare const removeFromCart: (req: Request, res: Response) => Promise<Response | void>;
export declare const clearCart: (req: Request, res: Response) => Promise<Response | void>;
export declare const createOrder: (req: Request, res: Response) => Promise<Response | void>;
export declare const verifyPayment: (req: Request, res: Response) => Promise<Response | void>;
//# sourceMappingURL=cartController.d.ts.map