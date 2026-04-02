import mongoose, { Document, Schema } from "mongoose";
import * as bcrypt from "bcryptjs";

export interface IAddress {
  _id: mongoose.Types.ObjectId;
  name: string;
  label: string;
  pincode: string;
  city: string;
  state: string;
  postal_district: string;
  admin_district: string;
  addressLine: string;
  phone: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  isGeocoded?: boolean; // Whether coordinates were obtained via geocoding
  coordsSource?: 'manual' | 'geocoded' | 'pincode' | 'unresolved'; // How coordinates were obtained
  validationSource?: 'manual' | 'gps'; // How pincode was validated
  gpsAccuracy?: number; // GPS accuracy in meters (if provided)
}

export interface IOAuthProvider {
  provider: "google";
  providerId: string;
}

export interface IDeliveryDocument {
  type: string;
  url: string;
  uploadedAt: Date;
}

export interface IDeliveryProfile {
  phone: string;
  vehicleType: "bike" | "car" | "cycle" | "scooter" | "walking";
  assignedAreas: string[]; // pincodes
  aadharOrId?: string;
  documents: IDeliveryDocument[];
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
}

export interface INotificationPreferences {
  whatsapp?: {
    enabled?: boolean;
    categories?: {
      myOrders?: boolean;
      reminders?: {
        enabled?: boolean;
        subcategories?: {
          reminders_cart?: boolean;
          reminders_payment?: boolean;
          reminders_restock?: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
  email?: {
    enabled?: boolean;
    categories?: {
      myOrders?: boolean;
      reminders?: {
        enabled?: boolean;
        subcategories?: {
          reminders_cart?: boolean;
          reminders_payment?: boolean;
          reminders_restock?: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
  sms?: {
    enabled?: boolean;
    categories?: {
      myOrders?: boolean;
      reminders?: {
        enabled?: boolean;
        subcategories?: {
          reminders_cart?: boolean;
          reminders_payment?: boolean;
          reminders_restock?: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
  push?: {
    enabled?: boolean;
    categories?: {
      myOrders?: boolean;
      reminders?: {
        enabled?: boolean;
        subcategories?: {
          reminders_cart?: boolean;
          reminders_payment?: boolean;
          reminders_restock?: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
  desktop?: {
    enabled?: boolean;
    categories?: {
      myOrders?: boolean;
      reminders?: {
        enabled?: boolean;
        subcategories?: {
          reminders_cart?: boolean;
          reminders_payment?: boolean;
          reminders_restock?: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
  inapp?: {
    enabled?: boolean;
    categories?: {
      myOrders?: boolean;
      reminders?: {
        enabled?: boolean;
        subcategories?: {
          reminders_cart?: boolean;
          reminders_payment?: boolean;
          reminders_restock?: boolean;
        };
      };
      silentPay?: boolean;
      recommendations?: boolean;
      newOffers?: boolean;
      community?: boolean;
      feedback?: boolean;
      newProductAlerts?: boolean;
    };
  };
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  avatar?: string; // Profile picture from OAuth or upload
  isDeleted?: boolean;
  deletedAt?: Date | null;
  passwordHash?: string;
  oauthProviders?: IOAuthProvider[];
  role: "customer" | "admin" | "delivery";
  status?: "pending" | "active" | "suspended";
  deliveryProfile?: IDeliveryProfile;
  addresses: IAddress[];
  notificationPreferences?: INotificationPreferences;
  appLanguage?: string;
  preferredLanguage?: string;
  isProfileComplete?: boolean;
  mobileVerified?: boolean;
  // Email change verification fields
  pendingEmail?: string;
  pendingEmailToken?: string;
  pendingEmailExpiresAt?: Date;
  lastEmailChangeRequestAt?: Date;
  pushToken?: string; // Generic push token
  expoPushToken?: string; // Specifically for Expo Push API
  // Loyalty and Referral
  loyaltyPoints?: number;
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  referralCode?: string | null;
  referredBy?: mongoose.Types.ObjectId | null;
  // Analytics
  lastLoginAt?: Date | null;
  totalOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  totalSpent?: number;
  averageOrderValue?: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema<IAddress>({
  name: { type: String, required: false, default: "" },
  label: { type: String, required: true },
  pincode: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postal_district: { type: String, required: true },
  admin_district: { type: String, required: true },
  addressLine: { type: String, required: true },
  phone: { type: String, required: false, default: "" },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  isDefault: { type: Boolean, default: false },
  isGeocoded: { type: Boolean, default: false },
  coordsSource: { 
    type: String, 
    enum: ['manual', 'saved', 'geocoded', 'pincode', 'unresolved'], 
    default: 'unresolved' 
  },
  validationSource: { 
    type: String, 
    enum: ['manual', 'gps'], 
    default: 'manual' 
  },
  gpsAccuracy: { type: Number, required: false },
});

const OAuthProviderSchema = new Schema<IOAuthProvider>({
  provider: { type: String, enum: ["google"], required: true },
  providerId: { type: String, required: true },
});

const DeliveryDocumentSchema = new Schema<IDeliveryDocument>({
  type: { type: String, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const DeliveryProfileSchema = new Schema<IDeliveryProfile>({
  phone: { type: String, required: true },
  vehicleType: {
    type: String,
    enum: ["bike", "car", "cycle", "scooter", "walking"],
    required: true,
  },
  assignedAreas: [{ type: String }],
  aadharOrId: { type: String },
  documents: [DeliveryDocumentSchema],
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
});

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: false, // Make name optional for OAuth users
      default: undefined, // Use undefined instead of "" to prevent empty string issues
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      // Email validation - supports plus signs, multiple dots, long TLDs
      match: [
        /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
        "Please enter a valid email",
      ],
      // Additional validation to prevent empty strings
      validate: {
        validator: function(v: string): boolean {
          return Boolean(v && v.trim().length > 0);
        },
        message: "Email cannot be empty",
      },
    },
    phone: {
      type: String,
      required: false, // Make phone optional by default
      default: undefined, // Use undefined instead of "" to prevent empty string issues
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Please enter a valid Indian phone number (10 digits starting with 6-9)",
      ],
    },
    avatar: {
      type: String,
      required: false,
      default: undefined,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    passwordHash: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never include in queries by default - must be explicitly selected
    },
    oauthProviders: [OAuthProviderSchema],
    role: {
      type: String,
      enum: ["customer", "admin", "delivery"],
      default: "customer",
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "active",
    },
    deliveryProfile: DeliveryProfileSchema,
    addresses: [AddressSchema],
    appLanguage: {
      type: String,
      default: "English",
      trim: true,
    },
    preferredLanguage: {
      type: String,
      default: "English",
      trim: true,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    mobileVerified: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      type: Schema.Types.Mixed,
      default: {},
    },
    pushToken: {
      type: String,
      required: false,
    },
    expoPushToken: {
      type: String,
      required: false,
    },
    // Email change verification fields
    pendingEmail: {
      type: String,
      default: null,
    },
    pendingEmailToken: {
      type: String,
      default: null,
    },
    pendingEmailExpiresAt: {
      type: Date,
      default: null,
    },
    lastEmailChangeRequestAt: {
      type: Date,
      default: null,
    },
    // Loyalty and Referral
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    loyaltyTier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },
    referralCode: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Analytics
    lastLoginAt: {
      type: Date,
      default: null,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    completedOrders: {
      type: Number,
      default: 0,
    },
    cancelledOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    averageOrderValue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: "string", $ne: "" },
    },
  }
);

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
