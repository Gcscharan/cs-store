import { Request, Response } from "express";
import { UserProfileService } from "../../user/services/UserProfileService";
import { UserAddressService } from "../../user/services/UserAddressService";
import { UserAccountService } from "../../user/services/UserAccountService";
import mongoose from "mongoose";
import { User, IAddress } from "../../../models/User";
import { Cart } from "../../../models/Cart";
import { Order } from "../../../models/Order";
import { Payment } from "../../../models/Payment";
import Otp from "../../../models/Otp";
import Notification from "../../../models/Notification";
import { geocodeByPincode, smartGeocode } from "../../../utils/geocoding";
import { resolvePincodeAuthoritatively } from "../../../utils/authoritativePincodeResolver";
import {
  resolvePincodeForAddressSave,
} from "../../../utils/pincodeResolver";

// Get user profile
export const getUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const userProfileService = new UserProfileService();
    const result = await userProfileService.getUserProfile(userId);

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark mobile as verified with OTP
export const markMobileAsVerified = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    const { otp, phone, pendingUserId } = req.body;

    if (!otp) {
      res.status(400).json({ error: "OTP is required" });
      return;
    }

    const userAccountService = new UserAccountService();
    const result = await userAccountService.verifyMobile(userId, { otp, phone, pendingUserId });

    res.status(userId ? 200 : 201).json(result);
  } catch (error) {
    console.error("Error verifying mobile:", error);
    res.status(500).json({ error: "Failed to verify mobile number" });
  }
};

// Update user profile
export const updateUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { name, phone, email } = req.body;
    
    const userProfileService = new UserProfileService();
    const result = await userProfileService.updateUserProfile(userId, { name, phone, email });

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(result);
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// Get user addresses
export const getUserAddresses = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const userAddressService = new UserAddressService();
    const result = await userAddressService.getUserAddresses(userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user addresses:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Add user address
export const addUserAddress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.error("🔥 addUserAddress controller HIT");

    const userId = (req as any).userId || (req as any).user?._id;

    console.info("[addUserAddress] Incoming payload:", {
      userId,
      body: req.body,
    });

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const {
      name,
      label,
      pincode,
      city,
      state,
      addressLine: addressLineFromBody,
      address_line: addressLineSnake,
      phone,
      isDefault,
    } = req.body;

    const addressLine = addressLineFromBody || addressLineSnake;

    if (typeof resolvePincodeAuthoritatively !== "function") {
      throw new Error("resolvePincodeAuthoritatively is undefined");
    }

    if (!pincode || typeof pincode !== "string" || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      console.warn("[addUserAddress] Invalid pincode:", pincode);
      res.status(400).json({
        success: false,
        message: "Invalid pincode",
      });
      return;
    }

    if (!city || typeof city !== "string" || !city.trim()) {
      console.warn("[addUserAddress] Missing/invalid city:", city);
      res.status(400).json({
        success: false,
        message: "City is required",
      });
      return;
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      console.warn("[addUserAddress] Missing/invalid name:", name);
      res.status(400).json({
        success: false,
        message: "Name is required",
      });
      return;
    }

    const cleanedPhone = typeof phone === "string" ? phone.trim() : "";
    if (!cleanedPhone || !/^[6-9]\d{9}$/.test(cleanedPhone)) {
      console.warn("[addUserAddress] Missing/invalid phone:", phone);
      res.status(400).json({
        success: false,
        message: "Phone is required",
      });
      return;
    }

    if (!addressLine || typeof addressLine !== "string" || !addressLine.trim()) {
      console.warn("[addUserAddress] Missing/invalid addressLine:", addressLine);
      res.status(400).json({
        success: false,
        message: "Address line is required",
      });
      return;
    }

    // Validate required fields
    if (!label) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Backfill existing addresses that might be missing required district fields.
    // Without this, user.save() can fail validation even if the NEW address is valid.
    for (const addr of user.addresses || []) {
      const needsBackfill = !addr.postal_district || !addr.admin_district;
      if (!needsBackfill) continue;

      const addrPincode = (addr.pincode || "").toString();
      if (!/^\d{6}$/.test(addrPincode)) {
        console.error("[addUserAddress] Existing address has invalid pincode; cannot backfill", {
          addressId: addr._id?.toString?.(),
          pincode: addrPincode,
        });
        res.status(400).json({
          success: false,
          message: "Invalid address payload",
          details: {
            reason: "Existing address has invalid pincode; cannot backfill districts",
            addressId: addr._id?.toString?.(),
            pincode: addrPincode,
          },
        });
        return;
      }

      const backfill = await resolvePincodeAuthoritatively(addrPincode);
      if (!backfill) {
        console.error("[addUserAddress] Failed to backfill existing address districts", {
          addressId: addr._id?.toString?.(),
          pincode: addrPincode,
        });
        res.status(400).json({
          success: false,
          message: "Invalid address payload",
          details: {
            reason: "Failed to resolve pincode for existing address; cannot backfill districts",
            addressId: addr._id?.toString?.(),
            pincode: addrPincode,
          },
        });
        return;
      }

      addr.state = backfill.state;
      addr.postal_district = backfill.postal_district;
      addr.admin_district = backfill.admin_district;
    }

    // AUTO-GEOCODE: Convert address to GPS coordinates with fallback chain
    console.log(`\n🌍 Auto-geocoding address for user ${userId}...`);
    
    // Try full address geocoding first
    let geocodeResult = await smartGeocode(addressLine, city, state, pincode);
    let coordsSource: 'geocoded' | 'pincode' = 'geocoded';
    
    if (!geocodeResult) {
      // Full geocoding failed, try pincode fallback
      console.warn(`⚠️ Full address geocoding failed, trying pincode fallback for ${pincode}...`);
      geocodeResult = await geocodeByPincode(pincode);
      
      if (geocodeResult) {
        console.log(`✅ Pincode geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
        console.warn(`⚠️ Using PINCODE CENTROID - delivery fee will be ESTIMATED`);
        coordsSource = 'pincode';
      } else {
        // Both geocoding attempts failed
        console.error(`❌ All geocoding failed for: ${addressLine}, ${city}, ${state} - ${pincode}`);
        res.status(400).json({
          success: false,
          message: "Unable to locate this address or pincode. Please check:\n• Address has specific details (street name, landmark)\n• Pincode is correct\n• City and state are correct",
        });
        return;
      }
    } else {
      console.log(`✅ Full address geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
    }

    // If this is set as default, remove default from all other addresses
    if (isDefault) {
      user.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    const resolved = await resolvePincodeAuthoritatively(pincode);
    console.error("🔥 Resolver output:", resolved);

    if (!resolved) {
      res.status(400).json({
        success: false,
        message: "Invalid pincode",
        details: { reason: "Pincode not supported" },
      });
      return;
    }

    const resolvedState = resolved.state;
    const postalDistrict = resolved.postal_district;
    const adminDistrict = resolved.admin_district;

    const newAddress: IAddress = {
      _id: new mongoose.Types.ObjectId(),
      name: name.trim(),
      label,
      pincode,
      city: city.trim(),
      state: resolvedState,
      postal_district: postalDistrict || "",
      admin_district: adminDistrict || "",
      addressLine,
      phone: cleanedPhone,
      lat: geocodeResult.lat,  // Auto-geocoded latitude
      lng: geocodeResult.lng,  // Auto-geocoded longitude
      isDefault: isDefault || false,
      isGeocoded: true,  // Coordinates obtained via geocoding
      coordsSource: coordsSource,  // 'geocoded' or 'pincode' based on which method worked
    };

    user.addresses.push(newAddress);
    try {
      await user.save();
    } catch (dbErr) {
      console.error("🔥 Mongo save failed", dbErr);
      throw dbErr;
    }

    // Get the saved address from the user document
    const savedAddress: any = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      address: {
        ...(savedAddress.toObject ? savedAddress.toObject() : savedAddress),
        id: savedAddress._id.toString(),
      },
    });
  } catch (error: any) {
    console.error("🔥 addUserAddress CRASH", error, error?.stack);

    if (error?.name === "ValidationError") {
      res.status(400).json({
        success: false,
        message: "Invalid address payload",
        details: error?.errors || error,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Address save crashed",
      error: error?.message,
    });
  }
};

// Update user address
export const updateUserAddress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    const { addressId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const address = user.addresses.find(
      (addr: any) => addr._id.toString() === addressId
    );

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    const { name, label, pincode, city, state, addressLine, phone, isDefault } =
      req.body;

    if (pincode !== undefined) {
      const p = String(pincode);
      if (p.length !== 6 || !/^\d{6}$/.test(p)) {
        res.status(400).json({
          success: false,
          message: "Invalid pincode",
        });
        return;
      }
    }

    // Check if address components changed (requires re-geocoding)
    const addressChanged = 
      (addressLine && addressLine !== address.addressLine) ||
      (city && city !== address.city) ||
      (state && state !== address.state) ||
      (pincode && pincode !== address.pincode);

    // If address changed, re-geocode with fallback
    if (addressChanged) {
      const finalAddressLine = addressLine || address.addressLine;
      const finalCity = city || address.city;
      const finalState = state || address.state;
      const finalPincode = pincode || address.pincode;
      
      console.log(`\n🌍 Re-geocoding updated address for user ${userId}...`);
      let geocodeResult = await smartGeocode(finalAddressLine, finalCity, finalState, finalPincode);
      let coordsSource: 'geocoded' | 'pincode' = 'geocoded';
      
      if (!geocodeResult) {
        // Full geocoding failed, try pincode fallback
        console.warn(`⚠️ Full address geocoding failed, trying pincode fallback for ${finalPincode}...`);
        geocodeResult = await geocodeByPincode(finalPincode);
        
        if (geocodeResult) {
          console.log(`✅ Pincode geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
          console.warn(`⚠️ Using PINCODE CENTROID - delivery fee will be ESTIMATED`);
          coordsSource = 'pincode';
        } else {
          // Both attempts failed
          console.error(`❌ All geocoding failed for: ${finalAddressLine}, ${finalCity}, ${finalState} - ${finalPincode}`);
          res.status(400).json({
            success: false,
            message: "Unable to locate this address or pincode. Please check your address details.",
          });
          return;
        }
      } else {
        console.log(`✅ Full address re-geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
      }
      
      address.lat = geocodeResult.lat;
      address.lng = geocodeResult.lng;
      address.isGeocoded = true;
      address.coordsSource = coordsSource;
    }

    // Update other address fields
    if (name !== undefined) address.name = name || "";
    if (label) address.label = label;
    if (pincode) address.pincode = pincode;
    if (city) address.city = String(city).trim();
    if (state) address.state = state;
    if (addressLine) address.addressLine = addressLine;
    if (phone !== undefined) address.phone = phone || "";
    if (isDefault !== undefined) {
      // If this is set as default, remove default from all other addresses
      if (isDefault) {
        user.addresses.forEach((addr: any) => {
          if (addr._id.toString() !== addressId) {
            addr.isDefault = false;
          }
        });
      }
      address.isDefault = isDefault;
    }

    const finalPincode = (pincode || address.pincode || "").toString();
    const finalCity = (city || address.city || "").toString();
    const resolved = await resolvePincodeForAddressSave(finalPincode);
    if (!resolved) {
      res.status(400).json({
        success: false,
        message: "Invalid pincode",
      });
      return;
    }

    if (!finalCity || !finalCity.trim()) {
      res.status(400).json({
        success: false,
        message: "City is required",
      });
      return;
    }

    const finalName = (name !== undefined ? String(name) : String(address.name || "")).trim();
    if (!finalName) {
      res.status(400).json({
        success: false,
        message: "Name is required",
      });
      return;
    }

    const finalPhone = (phone !== undefined ? String(phone) : String(address.phone || "")).trim();
    if (!finalPhone || !/^[6-9]\d{9}$/.test(finalPhone)) {
      res.status(400).json({
        success: false,
        message: "Phone is required",
      });
      return;
    }

    address.name = finalName;
    address.phone = finalPhone;
    address.city = finalCity.trim();
    address.state = resolved.state;
    address.postal_district = resolved.postal_district;
    address.admin_district = resolved.admin_district;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: {
        ...address,
        id: address._id.toString(),
      },
    });
  } catch (error) {
    console.error("Error updating user address:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete user address
export const deleteUserAddress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    const { addressId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const address = user.addresses.find(
      (addr: any) => addr._id.toString() === addressId
    );

    if (!address) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    // Check if the address being deleted is the default
    const wasDefault = address.isDefault;

    // Remove the address
    user.addresses = user.addresses.filter(
      (addr: any) => addr._id.toString() !== addressId
    );

    // If the deleted address was default and there are remaining addresses,
    // set the first remaining address as the new default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      defaultUpdated: wasDefault && user.addresses.length > 0,
    });
  } catch (error) {
    console.error("Error deleting user address:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Set an address as default
export const setDefaultAddress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    const { addressId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const address = user.addresses.find(
      (addr: any) => addr._id.toString() === addressId
    );

    if (!address) {
      res.status(404).json({ success: false, message: "Address not found" });
      return;
    }

    // Set all addresses to not default
    user.addresses.forEach((addr: any) => {
      addr.isDefault = false;
    });

    // Set the selected address as default
    address.isDefault = true;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      address: {
        ...address,
        id: address._id.toString(),
      },
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete user account with comprehensive cascading deletion
export const deleteAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  const session = await mongoose.startSession();
  
  try {
    console.log('🗑️ ACCOUNT DELETION: Starting comprehensive account deletion process...');
    
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({ 
        success: false,
        error: "User not authenticated" 
      });
      return;
    }

    console.log(`🗑️ ACCOUNT DELETION: Processing deletion for user ID: ${userId}`);

    // Start transaction for data integrity
    await session.startTransaction();

    // Step 1: Verify user exists
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ 
        success: false,
        error: "User not found" 
      });
      return;
    }

    console.log(`🗑️ ACCOUNT DELETION: Found user: ${user.email} (${user.name})`);

    // Step 2: Delete Cart data
    console.log('🗑️ STEP 2: Deleting Cart data...');
    const cartDeleteResult = await Cart.deleteMany({ userId }).session(session);
    console.log(`✅ Deleted ${cartDeleteResult.deletedCount} cart records`);

    // Step 3: Anonymize Orders (DO NOT DELETE - preserve business records)
    console.log('🗑️ STEP 3: Anonymizing Order data...');
    const orderAnonymizeResult = await Order.updateMany(
      { userId },
      {
        $set: {
          userId: null, // Remove user reference
          "address.name": "DELETED_USER",
          "address.phone": "DELETED_USER",
          // Keep address structure but anonymize personal info
        },
        $unset: {
          // Remove any other sensitive fields if they exist
          customerName: "",
          customerEmail: "",
          customerPhone: "",
        }
      },
      { session }
    );
    console.log(`✅ Anonymized ${orderAnonymizeResult.modifiedCount} order records`);

    // Step 4: Delete Payment records
    console.log('🗑️ STEP 4: Deleting Payment records...');
    const paymentDeleteResult = await Payment.deleteMany({ userId }).session(session);
    console.log(`✅ Deleted ${paymentDeleteResult.deletedCount} payment records`);

    // Step 5: Delete OTP records (by phone number)
    console.log('🗑️ STEP 5: Deleting OTP records...');
    const otpDeleteResult = await Otp.deleteMany({ phone: user.phone }).session(session);
    console.log(`✅ Deleted ${otpDeleteResult.deletedCount} OTP records`);

    // Step 6: Delete Notifications
    console.log('🗑️ STEP 6: Deleting Notification records...');
    const notificationDeleteResult = await Notification.deleteMany({ userId }).session(session);
    console.log(`✅ Deleted ${notificationDeleteResult.deletedCount} notification records`);

    // Step 7: Delete the User document itself
    console.log('🗑️ STEP 7: Deleting User document...');
    await User.findByIdAndDelete(userId).session(session);
    console.log(`✅ Deleted user document: ${userId}`);

    // Commit the transaction
    await session.commitTransaction();
    console.log('✅ Database transaction committed successfully');

    // Step 8: Security - Invalidate current session token
    console.log('🗑️ STEP 8: Token invalidation...');
    // Note: Token invalidation is handled by the client-side logout process
    // The token will naturally expire, and the user is deleted so no refresh possible
    console.log('✅ Token invalidation noted (handled by client logout)');

    console.log('🎉 ACCOUNT DELETION COMPLETED SUCCESSFULLY');

    res.status(200).json({
      success: true,
      message: "Account deleted successfully. All personal data has been removed.",
      forceLogout: true,
      details: {
        cartsDeleted: cartDeleteResult.deletedCount,
        ordersAnonymized: orderAnonymizeResult.modifiedCount,
        paymentsDeleted: paymentDeleteResult.deletedCount,
        otpsDeleted: otpDeleteResult.deletedCount,
        notificationsDeleted: notificationDeleteResult.deletedCount,
        userDeleted: true,
      }
    });

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    console.error('❌ ACCOUNT DELETION FAILED:', error);
    
    res.status(500).json({ 
      success: false,
      error: "Failed to delete account. Please try again or contact support.",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  } finally {
    // Always end the session
    await session.endSession();
  }
};

// Get user notification preferences (granular Flipkart-style)
export const getNotificationPreferences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const user = await User.findById(userId).select("notificationPreferences");

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Granular default preferences matching CS Store structure
    const defaultPreferences = {
      whatsapp: {
        enabled: true,
        categories: {
          myOrders: true,
          reminders: {
            enabled: true,
            subcategories: {
              reminders_cart: true,
              reminders_payment: true,
              reminders_restock: true,
            },
          },
          silentPay: true,
          recommendations: true,
          newOffers: true,
          community: false,
          feedback: true,
          newProductAlerts: true,
        },
      },
      email: {
        enabled: true,
        categories: {
          myOrders: true,
          reminders: {
            enabled: true,
            subcategories: {
              reminders_cart: true,
              reminders_payment: true,
              reminders_restock: true,
            },
          },
          silentPay: true,
          recommendations: true,
          newOffers: true,
          community: true,
          feedback: true,
          newProductAlerts: true,
        },
      },
      sms: {
        enabled: true,
        categories: {
          myOrders: true,
          reminders: {
            enabled: false,
            subcategories: {
              reminders_cart: false,
              reminders_payment: false,
              reminders_restock: false,
            },
          },
          silentPay: false,
          recommendations: false,
          newOffers: false,
          community: false,
          feedback: false,
          newProductAlerts: false,
        },
      },
      push: {
        enabled: true,
        categories: {
          myOrders: true,
          reminders: {
            enabled: true,
            subcategories: {
              reminders_cart: true,
              reminders_payment: true,
              reminders_restock: true,
            },
          },
          silentPay: true,
          recommendations: true,
          newOffers: true,
          community: false,
          feedback: true,
          newProductAlerts: true,
        },
      },
      desktop: {
        enabled: true,
        categories: {
          myOrders: true,
          reminders: {
            enabled: true,
            subcategories: {
              reminders_cart: true,
              reminders_payment: true,
              reminders_restock: true,
            },
          },
          silentPay: true,
          recommendations: true,
          newOffers: true,
          community: false,
          feedback: true,
          newProductAlerts: true,
        },
      },
      inapp: {
        enabled: true,
        categories: {
          myOrders: true,
          reminders: {
            enabled: true,
            subcategories: {
              reminders_cart: true,
              reminders_payment: true,
              reminders_restock: true,
            },
          },
          silentPay: true,
          recommendations: true,
          newOffers: true,
          community: true,
          feedback: true,
          newProductAlerts: true,
        },
      },
    };

    const stored = (user as any).notificationPreferences;
    const hasStored = stored && typeof stored === "object" && Object.keys(stored).length > 0;

    res.json(hasStored ? stored : defaultPreferences);
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update user notification preferences (granular support)
export const updateNotificationPreferences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).userId || (req as any).user?._id;
    const { preferences, channelId, categoryKey, subcategoryKey, enabled } = req.body;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Full-object update path
    if (preferences && typeof preferences === "object") {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { notificationPreferences: preferences },
        { new: true }
      ).select("notificationPreferences");

      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Notification preferences updated successfully",
        preferences: (updatedUser as any).notificationPreferences,
      });
      return;
    }

    // Granular toggle update path
    // Type check channelId
    if (typeof channelId !== "string" || !["whatsapp", "email", "sms", "push", "desktop", "inapp"].includes(channelId)) {
      res.status(400).json({ error: "Invalid channel ID" });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Initialize notificationPreferences if it doesn't exist
    if (!user.notificationPreferences) {
      user.notificationPreferences = {} as any;
    }

    const prefs: any = user.notificationPreferences;

    if (enabled !== undefined && !categoryKey) {
      if (!prefs[channelId]) {
        prefs[channelId] = { enabled: true, categories: {} };
      }
      prefs[channelId].enabled = enabled;
    } else if (channelId && categoryKey) {
      if (!prefs[channelId]) {
        prefs[channelId] = { enabled: true, categories: {} };
      }
      if (!prefs[channelId].categories) {
        prefs[channelId].categories = {};
      }

      if (subcategoryKey) {
        if (categoryKey === "reminders") {
          if (!prefs[channelId].categories[categoryKey]) {
            prefs[channelId].categories[categoryKey] = { enabled: true, subcategories: {} };
          }
          if (!prefs[channelId].categories[categoryKey].subcategories) {
            prefs[channelId].categories[categoryKey].subcategories = {};
          }
          prefs[channelId].categories[categoryKey].subcategories[subcategoryKey] = enabled;
        }
      } else {
        if (categoryKey === "reminders") {
          if (!prefs[channelId].categories[categoryKey]) {
            prefs[channelId].categories[categoryKey] = { enabled: enabled, subcategories: {} };
          } else {
            prefs[channelId].categories[categoryKey].enabled = enabled;
          }
        } else {
          prefs[channelId].categories[categoryKey] = enabled;
        }
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    console.error("❌ Error updating notification preferences:", error);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
};
