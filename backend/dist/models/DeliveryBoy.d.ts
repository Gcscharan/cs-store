import mongoose, { Document } from "mongoose";
export interface ICurrentLocation {
    lat: number;
    lng: number;
    lastUpdatedAt: Date;
}
export interface IDeliveryBoy extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    phone: string;
    email?: string;
    userId?: mongoose.Types.ObjectId;
    vehicleType: string;
    isActive: boolean;
    availability: "available" | "busy" | "offline";
    currentLocation: ICurrentLocation;
    earnings: number;
    completedOrdersCount: number;
    assignedOrders: mongoose.Types.ObjectId[];
    selfieUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DeliveryBoy: mongoose.Model<IDeliveryBoy, {}, {}, {}, mongoose.Document<unknown, {}, IDeliveryBoy, {}, {}> & IDeliveryBoy & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DeliveryBoy.d.ts.map