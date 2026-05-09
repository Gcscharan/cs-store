import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVersion extends Document {
  productId: mongoose.Types.ObjectId;
  version: number;
  snapshot: {
    name: string;
    description: string;
    category: string;
    price: number;
    pricePerUnit?: number;
    mrp?: number;
    stock: number;
    weight: number;
    tags: string;
    status: 'draft' | 'published';
    images: string[];
  };
  changedFields: string[];
  actionType: 'update' | 'publish' | 'rollback';
  updatedBy: mongoose.Types.ObjectId;
  archived: boolean;
  createdAt: Date;
}

const ProductVersionSchema = new Schema<IProductVersion>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    
    snapshot: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      category: { type: String, required: true },
      price: { type: Number, required: true },
      pricePerUnit: { type: Number },
      mrp: { type: Number },
      stock: { type: Number, required: true },
      weight: { type: Number, required: true },
      tags: { type: String, default: '' },
      status: {
        type: String,
        enum: ['draft', 'published'],
        required: true,
      },
      images: [{ type: String }],
    },
    
    changedFields: [{ type: String }],
    
    actionType: {
      type: String,
      enum: ['update', 'publish', 'rollback'],
      required: true,
    },
    
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

//
// 🔥 INDEXES (CRITICAL FOR PERFORMANCE)
//

// Query by product + latest versions
ProductVersionSchema.index({ productId: 1, version: -1 });

// Chronological queries
ProductVersionSchema.index({ productId: 1, createdAt: -1 });

// Filter archived
ProductVersionSchema.index({ productId: 1, archived: 1 });

// 🚨 UNIQUE VERSION PER PRODUCT (RACE CONDITION PROTECTION)
ProductVersionSchema.index(
  { productId: 1, version: 1 },
  { unique: true }
);

export const ProductVersion = mongoose.model<IProductVersion>(
  'ProductVersion',
  ProductVersionSchema
);
