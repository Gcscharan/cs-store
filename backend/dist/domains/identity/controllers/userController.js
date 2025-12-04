"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationPreferences = exports.getNotificationPreferences = exports.deleteAccount = exports.setDefaultAddress = exports.deleteUserAddress = exports.updateUserAddress = exports.addUserAddress = exports.getUserAddresses = exports.updateUserProfile = exports.markMobileAsVerified = exports.getUserProfile = void 0;
const User_1 = require("../../../models/User");
const Cart_1 = require("../../../models/Cart");
const Order_1 = require("../../../models/Order");
const Payment_1 = require("../../../models/Payment");
const Notification_1 = __importDefault(require("../../../models/Notification"));
const Otp_1 = __importDefault(require("../../../models/Otp"));
const mongoose_1 = __importDefault(require("mongoose"));
const geocoding_1 = require("../../../utils/geocoding");
const otpController_1 = require("../../security/controllers/otpController");
const jwt = __importStar(require("jsonwebtoken"));
const PendingUser_1 = require("../../../models/PendingUser");
// Get user profile
const getUserProfile = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const user = await User_1.User.findById(userId).select("-passwordHash");
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
            isAdmin: user.isAdmin || false,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    }
    catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getUserProfile = getUserProfile;
// Mark mobile as verified with OTP
const markMobileAsVerified = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { otp, phone, pendingUserId } = req.body;
        if (!otp) {
            res.status(400).json({ error: "OTP is required" });
            return;
        }
        // Case A: Authenticated user verifying their mobile post-signup
        if (userId) {
            const user = await User_1.User.findById(userId);
            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            if (!user.phone) {
                res.status(400).json({ error: "User does not have a registered phone" });
                return;
            }
            const result = await (0, otpController_1.verifyOtp)(user.phone, otp, "verification");
            if (!result.valid) {
                res.status(400).json({ error: result.error || "Invalid OTP" });
                return;
            }
            user.mobileVerified = true;
            await user.save();
            await Otp_1.default.deleteMany({ phone: user.phone, type: "verification", isUsed: false });
            const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
            const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
            const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
            const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
            const isProfileComplete = !!(user.name && user.phone);
            res.status(200).json({
                message: "Mobile number verified successfully",
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isAdmin: user.role === "admin",
                    addresses: user.addresses,
                    isProfileComplete,
                    mobileVerified: true,
                },
                accessToken,
                refreshToken,
            });
            return;
        }
        // Case B: Unauthenticated verification flow for pending users
        if (!phone) {
            res.status(400).json({ error: "Phone is required for verification" });
            return;
        }
        console.log("[verify-mobile] Verifying OTP for", { phone });
        const result = await (0, otpController_1.verifyOtp)(phone, otp, "verification");
        if (!result.valid) {
            res.status(400).json({ error: result.error || "Invalid OTP" });
            return;
        }
        console.log("[verify-mobile] OTP verified. Fetching PendingUser", { pendingUserId, phone });
        let pendingUser = null;
        if (pendingUserId) {
            pendingUser = await PendingUser_1.PendingUser.findOne({ _id: pendingUserId, phone });
        }
        else {
            pendingUser = await PendingUser_1.PendingUser.findOne({ phone });
        }
        if (!pendingUser) {
            res.status(404).json({ error: "Pending signup not found for this phone" });
            return;
        }
        console.log("[verify-mobile] Creating final User from PendingUser", { id: pendingUser._id.toString(), email: pendingUser.email });
        const user = new User_1.User({
            name: pendingUser.name,
            email: pendingUser.email,
            phone: pendingUser.phone,
            passwordHash: pendingUser.passwordHash,
            addresses: pendingUser.addresses || [],
            mobileVerified: true,
        });
        await user.save();
        console.log("[verify-mobile] Cleanup PendingUser and unused OTPs", { id: pendingUser._id.toString() });
        await PendingUser_1.PendingUser.deleteOne({ _id: pendingUser._id });
        await Otp_1.default.deleteMany({ phone, type: "verification", isUsed: false });
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
        const accessToken = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        const refreshToken = jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
        const isProfileComplete = !!(user.name && user.phone);
        res.status(201).json({
            message: "Account created and mobile verified successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isAdmin: user.role === "admin",
                addresses: user.addresses,
                isProfileComplete,
                mobileVerified: true,
            },
            accessToken,
            refreshToken,
        });
        return;
    }
    catch (error) {
        console.error("Error verifying mobile:", {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            keyValue: error?.keyValue,
            stack: error?.stack?.split("\n").slice(0, 2).join(" | "),
        });
        res.status(500).json({ error: "Failed to verify mobile number", ...(process.env.NODE_ENV !== 'production' ? { errorDetails: {
                    name: error?.name,
                    message: error?.message,
                    code: error?.code,
                    keyValue: error?.keyValue,
                } } : {}) });
    }
};
exports.markMobileAsVerified = markMobileAsVerified;
// Update user profile
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        // Extract update fields from request body
        const { name, phone, email } = req.body;
        // Build update object with only provided fields
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone;
        // Handle email change with verification requirement
        if (email !== undefined && email !== user.email) {
            // Don't update email immediately - require verification
            return res.json({
                success: true,
                message: "Email change requires verification",
                emailChangePending: true,
                pendingEmail: email,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email, // Still return old email
                    phone: user.phone,
                    role: user.role,
                },
            });
        }
        // Use findByIdAndUpdate to atomically update and return new document
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, updateData, {
            new: true, // Return updated document
            runValidators: true, // Run schema validators
            select: "-passwordHash" // Exclude password hash
        });
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
    }
    catch (error) {
        console.error("❌ Error updating user profile:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
};
exports.updateUserProfile = updateUserProfile;
// Get user addresses
const getUserAddresses = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const user = await User_1.User.findById(userId).select("addresses");
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        // Transform addresses to include both _id and id for frontend compatibility
        const transformedAddresses = (user.addresses || []).map((addr) => ({
            ...addr.toObject(),
            id: addr._id.toString(),
        }));
        // Find the default address ID
        const defaultAddress = user.addresses.find((addr) => addr.isDefault);
        const defaultAddressId = defaultAddress ? defaultAddress._id.toString() : null;
        res.status(200).json({
            success: true,
            addresses: transformedAddresses,
            defaultAddressId: defaultAddressId,
        });
    }
    catch (error) {
        console.error("Error fetching user addresses:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.getUserAddresses = getUserAddresses;
// Add user address
const addUserAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const { name, label, pincode, city, state, addressLine, phone, isDefault } = req.body;
        // Validate required fields
        if (!label || !pincode || !city || !state || !addressLine) {
            res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
            return;
        }
        const user = await User_1.User.findById(userId);
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
        let geocodeResult = await (0, geocoding_1.smartGeocode)(addressLine, city, state, pincode);
        let coordsSource = 'geocoded';
        if (!geocodeResult) {
            // Full geocoding failed, try pincode fallback
            console.warn(`⚠️ Full address geocoding failed, trying pincode fallback for ${pincode}...`);
            const { geocodeByPincode } = require('../utils/geocoding');
            geocodeResult = await geocodeByPincode(pincode);
            if (geocodeResult) {
                console.log(`✅ Pincode geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
                console.warn(`⚠️ Using PINCODE CENTROID - delivery fee will be ESTIMATED`);
                coordsSource = 'pincode';
            }
            else {
                // Both geocoding attempts failed
                console.error(`❌ All geocoding failed for: ${addressLine}, ${city}, ${state} - ${pincode}`);
                res.status(400).json({
                    success: false,
                    message: "Unable to locate this address or pincode. Please check:\n• Address has specific details (street name, landmark)\n• Pincode is correct\n• City and state are correct",
                });
                return;
            }
        }
        else {
            console.log(`✅ Full address geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
        }
        // If this is set as default, remove default from all other addresses
        if (isDefault) {
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
        }
        const newAddress = {
            _id: new mongoose_1.default.Types.ObjectId(),
            name: name || "",
            label,
            pincode,
            city,
            state,
            addressLine,
            phone: phone || "",
            lat: geocodeResult.lat, // Auto-geocoded latitude
            lng: geocodeResult.lng, // Auto-geocoded longitude
            isDefault: isDefault || false,
            isGeocoded: true, // Coordinates obtained via geocoding
            coordsSource: coordsSource, // 'geocoded' or 'pincode' based on which method worked
        };
        user.addresses.push(newAddress);
        await user.save();
        // Get the saved address from the user document
        const savedAddress = user.addresses[user.addresses.length - 1];
        res.status(201).json({
            success: true,
            message: "Address added successfully",
            address: {
                ...(savedAddress.toObject ? savedAddress.toObject() : savedAddress),
                id: savedAddress._id.toString(),
            },
        });
    }
    catch (error) {
        console.error("Error adding user address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.addUserAddress = addUserAddress;
// Update user address
const updateUserAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { addressId } = req.params;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const address = user.addresses.find((addr) => addr._id.toString() === addressId);
        if (!address) {
            res.status(404).json({
                success: false,
                message: "Address not found",
            });
            return;
        }
        const { name, label, pincode, city, state, addressLine, phone, isDefault } = req.body;
        // Check if address components changed (requires re-geocoding)
        const addressChanged = (addressLine && addressLine !== address.addressLine) ||
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
            let geocodeResult = await (0, geocoding_1.smartGeocode)(finalAddressLine, finalCity, finalState, finalPincode);
            let coordsSource = 'geocoded';
            if (!geocodeResult) {
                // Full geocoding failed, try pincode fallback
                console.warn(`⚠️ Full address geocoding failed, trying pincode fallback for ${finalPincode}...`);
                const { geocodeByPincode } = require('../utils/geocoding');
                geocodeResult = await geocodeByPincode(finalPincode);
                if (geocodeResult) {
                    console.log(`✅ Pincode geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
                    console.warn(`⚠️ Using PINCODE CENTROID - delivery fee will be ESTIMATED`);
                    coordsSource = 'pincode';
                }
                else {
                    // Both attempts failed
                    console.error(`❌ All geocoding failed for: ${finalAddressLine}, ${finalCity}, ${finalState} - ${finalPincode}`);
                    res.status(400).json({
                        success: false,
                        message: "Unable to locate this address or pincode. Please check your address details.",
                    });
                    return;
                }
            }
            else {
                console.log(`✅ Full address re-geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
            }
            address.lat = geocodeResult.lat;
            address.lng = geocodeResult.lng;
            address.isGeocoded = true;
            address.coordsSource = coordsSource;
        }
        // Update other address fields
        if (name !== undefined)
            address.name = name || "";
        if (label)
            address.label = label;
        if (pincode)
            address.pincode = pincode;
        if (city)
            address.city = city;
        if (state)
            address.state = state;
        if (addressLine)
            address.addressLine = addressLine;
        if (phone !== undefined)
            address.phone = phone || "";
        if (isDefault !== undefined) {
            // If this is set as default, remove default from all other addresses
            if (isDefault) {
                user.addresses.forEach((addr) => {
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
    }
    catch (error) {
        console.error("Error updating user address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.updateUserAddress = updateUserAddress;
// Delete user address
const deleteUserAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { addressId } = req.params;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const address = user.addresses.find((addr) => addr._id.toString() === addressId);
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
        user.addresses = user.addresses.filter((addr) => addr._id.toString() !== addressId);
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
    }
    catch (error) {
        console.error("Error deleting user address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.deleteUserAddress = deleteUserAddress;
// Set an address as default
const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { addressId } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        const address = user.addresses.find((addr) => addr._id.toString() === addressId);
        if (!address) {
            res.status(404).json({ success: false, message: "Address not found" });
            return;
        }
        // Set all addresses to not default
        user.addresses.forEach((addr) => {
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
    }
    catch (error) {
        console.error("Error setting default address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.setDefaultAddress = setDefaultAddress;
// Delete user account with comprehensive cascading deletion
const deleteAccount = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        console.log('🗑️ ACCOUNT DELETION: Starting comprehensive account deletion process...');
        const userId = req.userId || req.user?._id;
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
        const user = await User_1.User.findById(userId).session(session);
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
        const cartDeleteResult = await Cart_1.Cart.deleteMany({ userId }).session(session);
        console.log(`✅ Deleted ${cartDeleteResult.deletedCount} cart records`);
        // Step 3: Anonymize Orders (DO NOT DELETE - preserve business records)
        console.log('🗑️ STEP 3: Anonymizing Order data...');
        const orderAnonymizeResult = await Order_1.Order.updateMany({ userId }, {
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
        }, { session });
        console.log(`✅ Anonymized ${orderAnonymizeResult.modifiedCount} order records`);
        // Step 4: Delete Payment records
        console.log('🗑️ STEP 4: Deleting Payment records...');
        const paymentDeleteResult = await Payment_1.Payment.deleteMany({ userId }).session(session);
        console.log(`✅ Deleted ${paymentDeleteResult.deletedCount} payment records`);
        // Step 5: Delete OTP records (by phone number)
        console.log('🗑️ STEP 5: Deleting OTP records...');
        const otpDeleteResult = await Otp_1.default.deleteMany({ phone: user.phone }).session(session);
        console.log(`✅ Deleted ${otpDeleteResult.deletedCount} OTP records`);
        // Step 6: Delete Notifications
        console.log('🗑️ STEP 6: Deleting Notification records...');
        const notificationDeleteResult = await Notification_1.default.deleteMany({ userId }).session(session);
        console.log(`✅ Deleted ${notificationDeleteResult.deletedCount} notification records`);
        // Step 7: Delete the User document itself
        console.log('🗑️ STEP 7: Deleting User document...');
        await User_1.User.findByIdAndDelete(userId).session(session);
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
    }
    catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();
        console.error('❌ ACCOUNT DELETION FAILED:', error);
        res.status(500).json({
            success: false,
            error: "Failed to delete account. Please try again or contact support.",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
    finally {
        // Always end the session
        await session.endSession();
    }
};
exports.deleteAccount = deleteAccount;
// Get user notification preferences (granular Flipkart-style)
const getNotificationPreferences = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const user = await User_1.User.findById(userId).select("notificationPreferences");
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
        const stored = user.notificationPreferences;
        const hasStored = stored && typeof stored === "object" && Object.keys(stored).length > 0;
        res.json(hasStored ? stored : defaultPreferences);
    }
    catch (error) {
        console.error("Error fetching notification preferences:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getNotificationPreferences = getNotificationPreferences;
// Update user notification preferences (granular support)
const updateNotificationPreferences = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { preferences, channelId, categoryKey, subcategoryKey, enabled } = req.body;
        if (!userId) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        // Full-object update path
        if (preferences && typeof preferences === "object") {
            const updatedUser = await User_1.User.findByIdAndUpdate(userId, { notificationPreferences: preferences }, { new: true }).select("notificationPreferences");
            if (!updatedUser) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            res.json({
                success: true,
                message: "Notification preferences updated successfully",
                preferences: updatedUser.notificationPreferences,
            });
            return;
        }
        // Granular toggle update path
        // Type check channelId
        if (typeof channelId !== "string" || !["whatsapp", "email", "sms", "push", "desktop", "inapp"].includes(channelId)) {
            res.status(400).json({ error: "Invalid channel ID" });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        // Initialize notificationPreferences if it doesn't exist
        if (!user.notificationPreferences) {
            user.notificationPreferences = {};
        }
        const prefs = user.notificationPreferences;
        if (enabled !== undefined && !categoryKey) {
            if (!prefs[channelId]) {
                prefs[channelId] = { enabled: true, categories: {} };
            }
            prefs[channelId].enabled = enabled;
        }
        else if (channelId && categoryKey) {
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
            }
            else {
                if (categoryKey === "reminders") {
                    if (!prefs[channelId].categories[categoryKey]) {
                        prefs[channelId].categories[categoryKey] = { enabled: enabled, subcategories: {} };
                    }
                    else {
                        prefs[channelId].categories[categoryKey].enabled = enabled;
                    }
                }
                else {
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
    }
    catch (error) {
        console.error("❌ Error updating notification preferences:", error);
        res.status(500).json({ error: "Failed to update notification preferences" });
    }
};
exports.updateNotificationPreferences = updateNotificationPreferences;
