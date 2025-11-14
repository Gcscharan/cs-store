import mongoose, { Document, Schema } from "mongoose";

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

const PaymentMethodDetailsSchema = new Schema({
  upi: {
    vpa: String,
    flow: String,
  },
  card: {
    last4: String,
    network: String,
    type: String,
    issuer: String,
  },
  netbanking: {
    bank: String,
  },
  wallet: {
    wallet_name: String,
  },
});

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "captured", "failed", "refunded"],
      default: "pending",
    },
    method: {
      type: String,
      enum: ["upi", "card", "netbanking", "wallet", "emi", "paylater"],
      required: true,
    },
    methodDetails: PaymentMethodDetailsSchema,
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userDetails: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phone: String,
    },
    orderDetails: {
      items: [
        {
          productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },
          name: {
            type: String,
            required: true,
          },
          price: {
            type: Number,
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
          },
        },
      ],
      totalAmount: {
        type: Number,
        required: true,
      },
      address: {
        label: { type: String, required: true },
        pincode: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        addressLine: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    razorpayResponse: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ razorpayPaymentId: 1 });
PaymentSchema.index({ createdAt: -1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
