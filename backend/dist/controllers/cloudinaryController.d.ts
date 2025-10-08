import { Request, Response } from "express";
import multer from "multer";
declare const upload: multer.Multer;
export declare const uploadImage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const uploadMultipleImages: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteImage: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getImageUrl: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export { upload };
//# sourceMappingURL=cloudinaryController.d.ts.map