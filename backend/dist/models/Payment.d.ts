import mongoose, { Document } from "mongoose";
export interface IPayment extends Document {
    _id: mongoose.Types.ObjectId;
    orderId: mongoose.Types.ObjectId;
    paymentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amount: number;
    currency: string;
    status: "pending" | "captured" | "failed" | "refunded";
    method: "upi" | "card" | "netbanking" | "wallet" | "emi" | "paylater";
    methodDetails?: {
        upi?: {
            vpa?: string;
            flow?: string;
        };
        card?: {
            last4?: string;
            network?: string;
            type?: string;
            issuer?: string;
        };
        netbanking?: {
            bank?: string;
        };
        wallet?: {
            wallet_name?: string;
        };
    };
    userId: mongoose.Types.ObjectId;
    userDetails: {
        name: string;
        email: string;
        phone?: string;
    };
    orderDetails: {
        items: Array<{
            productId: mongoose.Types.ObjectId;
            name: string;
            price: number;
            quantity: number;
        }>;
        totalAmount: number;
        address: {
            label: string;
            pincode: string;
            city: string;
            state: string;
            addressLine: string;
            lat: number;
            lng: number;
        };
    };
    razorpayResponse?: any;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Payment: mongoose.Model<IPayment, {}, {}, {}, mongoose.Document<unknown, {}, IPayment, {}, {}> & IPayment & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Payment.d.ts.map