import mongoose, { Document } from "mongoose";
export interface IProduct extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    description: string;
    category: string;
    price: number;
    mrp?: number;
    stock: number;
    weight: number;
    images: string[];
    sku?: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const Product: mongoose.Model<IProduct, {}, {}, {}, mongoose.Document<unknown, {}, IProduct, {}, {}> & IProduct & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Product.d.ts.map