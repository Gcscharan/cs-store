import mongoose, { Document } from "mongoose";
export interface IAddress {
    _id: mongoose.Types.ObjectId;
    label: string;
    pincode: string;
    city: string;
    state: string;
    addressLine: string;
    lat: number;
    lng: number;
    isDefault: boolean;
}
export interface IOAuthProvider {
    provider: "google" | "facebook";
    providerId: string;
}
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    passwordHash?: string;
    oauthProviders?: IOAuthProvider[];
    role: "customer" | "admin" | "delivery";
    addresses: IAddress[];
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map