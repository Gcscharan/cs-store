import mongoose, { Document, Schema } from "mongoose";
import * as bcrypt from "bcryptjs";

export interface IAddress {
  _id: mongoose.Types.ObjectId;
  name: string;
  label: string;
  pincode: string;
  city: string;
  state: string;
  addressLine: string;
  phone: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  isGeocoded?: boolean; // Whether coordinates were obtained via geocoding
  coordsSource?: 'manual' | 'geocoded' | 'pincode' | 'unresolved'; // How coordinates were obtained
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
  addressLine: { type: String, required: true },
  phone: { type: String, required: false, default: "" },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  isDefault: { type: Boolean, default: false },
  isGeocoded: { type: Boolean, default: false },
  coordsSource: { 
    type: String, 
    enum: ['manual', 'geocoded', 'pincode', 'unresolved'], 
    default: 'unresolved' 
  },
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
      default: "",
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      // Updated regex to support:
      // - Plus signs in local part (user+tag@domain.com)
      // - Multiple dots in domain (sub.domain.co.in)
      // - TLDs of any length (.museum, .technology, etc.)
      // - Special characters in local part (user.name@domain.com)
      match: [
        /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      required: false, // Make phone optional by default
      default: "",
      match: [
        /^[0-9]{10,15}$/,
        "Please enter a valid phone number (10-15 digits)",
      ],
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
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
