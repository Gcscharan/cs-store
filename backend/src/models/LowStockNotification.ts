import mongoose, { Document, Schema } from "mongoose";

export interface ILowStockNotification extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'LOW_STOCK';
  productId: mongoose.Types.ObjectId;
  productName: string;
  currentStock: number;
  priority: 'LOW' | 'CRITICAL';
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LowStockNotificationSchema = new Schema<ILowStockNotification>(
  {
    type: {
      type: String,
      enum: ['LOW_STOCK'],
      default: 'LOW_STOCK',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },
    priority: {
      type: String,
      enum: ['LOW', 'CRITICAL'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'lowstocknotifications',
  }
);

// Indexes as specified in requirements
LowStockNotificationSchema.index({ productId: 1, isRead: 1 }); // Fast duplicate detection
LowStockNotificationSchema.index({ createdAt: -1 }); // Fast sorting for retrieval
LowStockNotificationSchema.index({ isRead: 1 }); // Fast filtering by read status
LowStockNotificationSchema.index({ priority: 1 }); // Fast filtering by priority

const LowStockNotification = mongoose.model<ILowStockNotification>(
  'LowStockNotification',
  LowStockNotificationSchema
);

export default LowStockNotification;
