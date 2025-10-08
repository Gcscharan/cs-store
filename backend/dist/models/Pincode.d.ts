import mongoose, { Document } from "mongoose";
export interface IPincode extends Document {
    pincode: string;
    state: string;
    district?: string;
    taluka?: string;
}
export declare const Pincode: mongoose.Model<IPincode, {}, {}, {}, mongoose.Document<unknown, {}, IPincode, {}, {}> & IPincode & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Pincode.d.ts.map