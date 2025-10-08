import mongoose, { Document } from "mongoose";
export interface IOrderItem {
    productId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    qty: number;
}
export interface IOrderAddress {
    label: string;
    pincode: string;
    city: string;
    state: string;
    addressLine: string;
    lat: number;
    lng: number;
}
export interface IOrder extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    items: IOrderItem[];
    totalAmount: number;
    paymentStatus: "pending" | "paid" | "failed" | "refunded";
    orderStatus: "created" | "assigned" | "picked_up" | "in_transit" | "delivered" | "cancelled";
    deliveryBoyId?: mongoose.Types.ObjectId;
    address: IOrderAddress;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Order: mongoose.Model<IOrder, {}, {}, {}, mongoose.Document<unknown, {}, IOrder, {}, {}> & IOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Order.d.ts.map