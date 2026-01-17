import mongoose, { Document, Schema } from "mongoose";

export type VehicleType = "AUTO";

export type RouteStatus = "CREATED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export interface IRoute extends Document {
  routeId: string;
  orderIds: mongoose.Types.ObjectId[];
  routePath: string[];
  vehicleType: VehicleType;
  totalDistanceKm: number;
  estimatedTimeMin: number;
  status: RouteStatus;
  deliveryBoyId?: mongoose.Types.ObjectId | null;

  deliveredCount: number;
  failedCount: number;

  computedAt: Date;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
  {
    routeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    orderIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
        required: true,
      },
    ],
    routePath: {
      type: [String],
      required: true,
      default: [],
    },
    vehicleType: {
      type: String,
      enum: ["AUTO"],
      required: true,
      default: "AUTO",
    },
    totalDistanceKm: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedTimeMin: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["CREATED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"],
      required: true,
      default: "CREATED",
      index: true,
    },
    deliveryBoyId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
      index: true,
    },
    deliveredCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    failedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    computedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    assignedAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

RouteSchema.index({ status: 1, computedAt: -1 });
RouteSchema.index({ deliveryBoyId: 1, status: 1 });

export const Route = mongoose.model<IRoute>("Route", RouteSchema);
