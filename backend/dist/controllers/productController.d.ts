import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const getProducts: (req: Request, res: Response) => Promise<Response | void>;
export declare const getProductById: (req: Request, res: Response) => Promise<Response | void>;
export declare const createProduct: (req: AuthRequest, res: Response) => Promise<Response | void>;
export declare const updateProduct: (req: AuthRequest, res: Response) => Promise<Response | void>;
export declare const deleteProduct: (req: AuthRequest, res: Response) => Promise<Response | void>;
export declare const getSimilarProducts: (req: Request, res: Response) => Promise<Response | void>;
//# sourceMappingURL=productController.d.ts.map