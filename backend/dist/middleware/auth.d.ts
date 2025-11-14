import { Request, Response, NextFunction } from "express";
interface AuthRequest extends Request {
    user?: any;
}
export { AuthRequest };
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response | void>;
export declare const requireRole: (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response | void;
export declare const requireDeliveryRole: (req: AuthRequest, res: Response, next: NextFunction) => Response | void;
//# sourceMappingURL=auth.d.ts.map