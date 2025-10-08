import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  price: number;
  mrp?: number;
  stock: number;
  images: string[];
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
    images: [
      {
        type: String,
        required: [true, "At least one image is required"],
      },
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
