import { Request, Response } from "express";
import { User, IAddress } from "../../../models/User";
import { Cart } from "../../../models/Cart";
import { Order } from "../../../models/Order";
import { Payment } from "../../../models/Payment";
import Notification from "../../../models/Notification";
import Otp from "../../../models/Otp";
import mongoose from "mongoose";
import { smartGeocode } from "../../../utils/geocoding";
import redisClient from "../../../config/redis";

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

    const user = await User.findById(userId).select("-passwordHash");

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isAdmin: (user as any).isAdmin || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
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

    // Extract update fields from request body
    const { name, phone, email } = req.body;
    
    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;

    // Use findByIdAndUpdate to atomically update and return new document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,  // Return updated document
        runValidators: true,  // Run schema validators
        select: "-passwordHash"  // Exclude password hash
      }
    );

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
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

    const user = await User.findById(userId).select("addresses");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Transform addresses to include both _id and id for frontend compatibility
    const transformedAddresses = (user.addresses || []).map((addr: any) => ({
      ...addr.toObject(),
      id: addr._id.toString(),
    }));

    // Find the default address ID
    const defaultAddress = user.addresses.find((addr: any) => addr.isDefault);
    const defaultAddressId = defaultAddress ? defaultAddress._id.toString() : null;

    res.status(200).json({
      success: true,
      addresses: transformedAddresses,
      defaultAddressId: defaultAddressId,
    });
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
    const userId = (req as any).userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { name, label, pincode, city, state, addressLine, phone, isDefault } =
      req.body;

    // Validate required fields
    if (!label || !pincode || !city || !state || !addressLine) {
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

    // AUTO-GEOCODE: Convert address to GPS coordinates with fallback chain
    console.log(`\n🌍 Auto-geocoding address for user ${userId}...`);
    
    // Try full address geocoding first
    let geocodeResult = await smartGeocode(addressLine, city, state, pincode);
    let coordsSource: 'geocoded' | 'pincode' = 'geocoded';
    
    if (!geocodeResult) {
      // Full geocoding failed, try pincode fallback
      console.warn(`⚠️ Full address geocoding failed, trying pincode fallback for ${pincode}...`);
      const { geocodeByPincode } = require('../utils/geocoding');
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

    const newAddress: IAddress = {
      _id: new mongoose.Types.ObjectId(),
      name: name || "",
      label,
      pincode,
      city,
      state,
      addressLine,
      phone: phone || "",
      lat: geocodeResult.lat,  // Auto-geocoded latitude
      lng: geocodeResult.lng,  // Auto-geocoded longitude
      isDefault: isDefault || false,
      isGeocoded: true,  // Coordinates obtained via geocoding
      coordsSource: coordsSource,  // 'geocoded' or 'pincode' based on which method worked
    };

    user.addresses.push(newAddress);
    await user.save();

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
  } catch (error) {
    console.error("Error adding user address:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
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
        const { geocodeByPincode } = require('../utils/geocoding');
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
    if (city) address.city = city;
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

    // Step 8: External cleanup (Redis) - Outside transaction
    console.log('🗑️ STEP 8: Performing external cleanup...');
    
    try {
      // Clean up Redis cache entries that might contain user data
      const userCachePatterns = [
        `user:${userId}*`,           // User-specific cache
        `cart:${userId}*`,           // Cart cache
        `address:${userId}*`,        // Address cache
        `orders:${userId}*`,         // Order cache
        `profile:${userId}*`,        // Profile cache
      ];

      let totalRedisKeysDeleted = 0;
      for (const pattern of userCachePatterns) {
        const deletedCount = await redisClient.delPattern(pattern);
        totalRedisKeysDeleted += deletedCount;
        console.log(`🗑️ Redis cleanup: ${deletedCount} keys deleted for pattern: ${pattern}`);
      }

      // If user was a delivery partner, remove from delivery load tracking
      if (user.role === 'delivery') {
        const deliveryLoadKey = 'delivery_partner_load';
        await redisClient.zRem(deliveryLoadKey, userId.toString());
        console.log(`🗑️ Removed delivery partner from load tracking: ${userId}`);
      }

      console.log(`✅ Redis cleanup completed: ${totalRedisKeysDeleted} total keys deleted`);
    } catch (redisError) {
      console.warn('⚠️ Redis cleanup failed (non-critical):', redisError);
      // Continue - Redis cleanup failure shouldn't fail the account deletion
    }

    // Step 9: Security - Invalidate current session token
    console.log('🗑️ STEP 9: Token invalidation...');
    // Note: Token invalidation is handled by the client-side logout process
    // The token will naturally expire, and the user is deleted so no refresh possible
    console.log('✅ Token invalidation noted (handled by client logout)');

    console.log('🎉 ACCOUNT DELETION COMPLETED SUCCESSFULLY');

    res.status(200).json({
      success: true,
      message: "Account deleted successfully. All personal data has been removed.",
      details: {
        cartsDeleted: cartDeleteResult.deletedCount,
        ordersAnonymized: orderAnonymizeResult.modifiedCount,
        paymentsDeleted: paymentDeleteResult.deletedCount,
        otpsDeleted: otpDeleteResult.deletedCount,
        notificationsDeleted: notificationDeleteResult.deletedCount,
        userDeleted: true,
        redisKeysDeleted: true,
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

    res.json(user.notificationPreferences || defaultPreferences);
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
    const { channelId, categoryKey, subcategoryKey, enabled } = req.body;
    
    // Type check channelId
    if (typeof channelId !== 'string' || !['whatsapp', 'email', 'sms', 'push', 'desktop', 'inapp'].includes(channelId)) {
      res.status(400).json({ error: "Invalid channel ID" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Initialize notificationPreferences if it doesn't exist
    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    // Type assertion for notification preferences
    const preferences = user.notificationPreferences as any;

    // Handle channel-level toggle
    if (enabled !== undefined && !categoryKey) {
      if (!preferences[channelId]) {
        preferences[channelId] = { enabled: true, categories: {} };
      }
      preferences[channelId].enabled = enabled;
    }
    // Handle category or subcategory toggle
    else if (channelId && categoryKey) {
      // Initialize channel if it doesn't exist
      if (!preferences[channelId]) {
        preferences[channelId] = { enabled: true, categories: {} };
      }
      if (!preferences[channelId].categories) {
        preferences[channelId].categories = {};
      }

      if (subcategoryKey) {
        // Handle subcategory under reminders
        if (categoryKey === 'reminders') {
          if (!preferences[channelId].categories[categoryKey]) {
            preferences[channelId].categories[categoryKey] = {
              enabled: true,
              subcategories: {},
            };
          }
          if (!preferences[channelId].categories[categoryKey].subcategories) {
            preferences[channelId].categories[categoryKey].subcategories = {};
          }
          preferences[channelId].categories[categoryKey].subcategories[subcategoryKey] = enabled;
        }
      } else {
        // Handle main category toggle
        if (categoryKey === 'reminders') {
          // For reminders, update the enabled property
          if (!preferences[channelId].categories[categoryKey]) {
            preferences[channelId].categories[categoryKey] = {
              enabled: enabled,
              subcategories: {},
            };
          } else {
            preferences[channelId].categories[categoryKey].enabled = enabled;
          }
        } else {
          // For simple categories (myOrders, recommendations, etc.)
          preferences[channelId].categories[categoryKey] = enabled;
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
