import mongoose, { Document } from "mongoose";
export interface ICartItem {
    productId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    image: string;
    quantity: number;
}
export interface ICart extends Document {
    userId: mongoose.Types.ObjectId;
    items: ICartItem[];
    total: number;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Cart: mongoose.Model<ICart, {}, {}, {}, mongoose.Document<unknown, {}, ICart, {}, {}> & ICart & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Cart.d.ts.map