import { Request, Response } from "express";
export declare const signup: (req: Request, res: Response) => Promise<Response | void>;
export declare const login: (req: Request, res: Response) => Promise<Response | void>;
export declare const oauth: (req: Request, res: Response) => Promise<Response | void>;
export declare const refresh: (req: Request, res: Response) => Promise<Response | void>;
export declare const logout: (req: Request, res: Response) => Promise<Response | void>;
export declare const googleCallback: (req: Request, res: Response) => Promise<Response | void>;
export declare const changePassword: (req: Request, res: Response) => Promise<Response | void>;
//# sourceMappingURL=authController.d.ts.map