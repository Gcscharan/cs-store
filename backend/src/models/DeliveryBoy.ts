import mongoose, { Document, Schema } from "mongoose";

export interface ICurrentLocation {
  lat: number;
  lng: number;
  lastUpdatedAt: Date;
}

export interface IActiveRoute {
  polyline: string; // Encoded polyline from Google Directions API
  destination: {
    lat: number;
    lng: number;
  };
  orderId?: mongoose.Types.ObjectId;
  startedAt: Date;
  estimatedArrival?: Date;
}

export type KycStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED";
export type KycDocType = "aadhaar_front" | "aadhaar_back" | "pan_card" | "selfie";

export interface IKycDocument {
  docType: KycDocType;
  url: string;
  publicId?: string;
  uploadedAt: Date;
}

export interface IKyc {
  status: KycStatus;
  documents: IKycDocument[];
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
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
  activeRoute?: IActiveRoute; // Current delivery route
  earnings: number;
  completedOrdersCount: number;
  assignedOrders: mongoose.Types.ObjectId[];
  currentLoad: number; // Number of orders currently assigned
  rejectionsToday?: number;
  lastAssignedAt?: Date;
  selfieUrl?: string;
  kyc?: IKyc;
  createdAt: Date;
  updatedAt: Date;
}

const CurrentLocationSchema = new Schema<ICurrentLocation>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  lastUpdatedAt: { type: Date, default: Date.now },
});

const ActiveRouteSchema = new Schema<IActiveRoute>({
  polyline: { type: String, required: true },
  destination: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  startedAt: { type: Date, default: Date.now },
  estimatedArrival: { type: Date },
});

const KycDocumentSchema = new Schema<IKycDocument>(
  {
    docType: {
      type: String,
      enum: ["aadhaar_front", "aadhaar_back", "pan_card", "selfie"],
      required: true,
    },
    url: { type: String, required: true },
    publicId: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const KycSchema = new Schema<IKyc>(
  {
    status: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"],
      default: "NOT_STARTED",
    },
    documents: { type: [KycDocumentSchema], default: [] },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, trim: true },
  },
  { _id: false }
);

const DeliveryBoySchema = new Schema<IDeliveryBoy>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: [true, "Vehicle type is required"],
      enum: ["AUTO", "auto", "bike", "scooter", "cycle", "car", "walking"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    availability: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "offline",
    },
    currentLocation: CurrentLocationSchema,
    activeRoute: ActiveRouteSchema,
    earnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedOrdersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    assignedOrders: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    currentLoad: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectionsToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAssignedAt: {
      type: Date,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    selfieUrl: {
      type: String,
      trim: true,
    },
    kyc: {
      type: KycSchema,
      default: () => ({ status: "NOT_STARTED", documents: [] }),
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DeliveryBoySchema.index({ availability: 1, isActive: 1 });
DeliveryBoySchema.index({ "currentLocation.lat": 1, "currentLocation.lng": 1 });
DeliveryBoySchema.index({ userId: 1 });
// Note: phone index is created by unique: true in schema definition above
DeliveryBoySchema.index({ createdAt: -1 });

export const DeliveryBoy = mongoose.model<IDeliveryBoy>(
  "DeliveryBoy",
  DeliveryBoySchema
);
