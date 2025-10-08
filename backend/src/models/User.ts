import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAddress {
  _id: mongoose.Types.ObjectId;
  label: string;
  pincode: string;
  city: string;
  state: string;
  addressLine: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export interface IOAuthProvider {
  provider: "google" | "facebook";
  providerId: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash?: string;
  oauthProviders?: IOAuthProvider[];
  role: "customer" | "admin" | "delivery";
  addresses: IAddress[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema<IAddress>({
  label: { type: String, required: true },
  pincode: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  addressLine: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  isDefault: { type: Boolean, default: false },
});

const OAuthProviderSchema = new Schema<IOAuthProvider>({
  provider: { type: String, enum: ["google", "facebook"], required: true },
  providerId: { type: String, required: true },
});

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },
    passwordHash: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
    },
    oauthProviders: [OAuthProviderSchema],
    role: {
      type: String,
      enum: ["customer", "admin", "delivery"],
      default: "customer",
    },
    addresses: [AddressSchema],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash") || !this.passwordHash) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
