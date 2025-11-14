import mongoose, { Document } from "mongoose";
export interface IOtp extends Document {
    phone: string;
    otp: string;
    type: "payment" | "login" | "verification";
    orderId?: mongoose.Types.ObjectId;
    paymentId?: string;
    expiresAt: Date;
    isUsed: boolean;
    attempts: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IOtp, {}, {}, {}, mongoose.Document<unknown, {}, IOtp, {}, {}> & IOtp & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Otp.d.ts.map