import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  price: number;
  mrp?: number;
  stock: number;
  reservedStock?: number;
  weight: number;
  images: {
    publicId?: string;
    variants?: {
      micro?: string;
      thumb?: string;
      small?: string;
      medium?: string;
      large?: string;
      original?: string;
    };
    formats?: {
      avif?: string;
      webp?: string;
      jpg?: string;
    };
    metadata?: {
      width?: number;
      height?: number;
      aspectRatio?: number;
    };
  }[];
  sku?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "chocolates",
        "biscuits",
        "ladoos",
        "cakes",
        "hot_snacks",
        "groceries",
        "vegetables",
        "fruits",
        "dairy",
        "meat",
        "beverages",
        "snacks",
        "household",
        "personal_care",
        "medicines",
        "electronics",
        "clothing",
        "other",
      ],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    mrp: {
      type: Number,
      min: [0, "MRP cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    reservedStock: {
      type: Number,
      min: [0, "Reserved stock cannot be negative"],
      default: 0,
    },
    weight: {
      type: Number,
      required: [true, "Weight is required"],
      min: [0, "Weight cannot be negative"],
      default: 0,
    },
    images: [
      {
        publicId: { type: String },
        variants: {
          micro: { type: String },
          thumb: { type: String },
          small: { type: String },
          medium: { type: String },
          large: { type: String },
          original: { type: String }
        },
        formats: {
          avif: { type: String },
          webp: { type: String },
          jpg: { type: String }
        },
        metadata: {
          width: { type: Number },
          height: { type: Number },
          aspectRatio: { type: Number }
        }
      }
    ],
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for better search performance
ProductSchema.index({ name: "text", description: "text", tags: "text" });
ProductSchema.index({ category: 1 });
ProductSchema.index({ price: 1 });

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
