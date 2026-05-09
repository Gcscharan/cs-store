import mongoose, { Document, Schema } from "mongoose";

export interface IDeviceToken extends Document {
  _id: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  deviceToken: string;
  platform: 'ios' | 'android';
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceToken: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android'],
      required: true,
    },
    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'devicetokens',
  }
);

// Unique compound index: prevents duplicate registrations
DeviceTokenSchema.index({ adminId: 1, deviceToken: 1 }, { unique: true });

// Index for fast filtering of active tokens (90-day threshold)
DeviceTokenSchema.index({ lastActiveAt: 1 });

const DeviceToken = mongoose.model<IDeviceToken>(
  'DeviceToken',
  DeviceTokenSchema
);

export default DeviceToken;
