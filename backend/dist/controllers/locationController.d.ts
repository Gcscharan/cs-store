import { Request, Response } from "express";
export interface LocationData {
    pincode: string;
    city: string;
    state: string;
    address: string;
    lat: number;
    lng: number;
}
export declare const reverseGeocodeController: (req: Request, res: Response) => Promise<void>;
export declare const getCurrentLocationController: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=locationController.d.ts.map