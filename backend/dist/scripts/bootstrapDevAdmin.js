"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapDevAdmin = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const DEV_ADMIN_EMAIL = "gcs.charan@gmail.com";
const DEV_ADMIN_PASSWORD = "Gcs@2004";
const DEV_ADMIN_NAME = "Admin";
const DEV_ADMIN_PHONE = "9391795162";
const bootstrapDevAdmin = async () => {
    try {
        // Only run in development
        if (process.env.NODE_ENV === "production") {
            console.log("⚠️  Skipping dev admin bootstrap in production");
            return;
        }
        console.log("🔧 Bootstrapping dev admin user...");
        // Check if dev admin user exists
        let devAdmin = await User_1.User.findOne({ email: DEV_ADMIN_EMAIL });
        if (!devAdmin) {
            // Create new dev admin user
            const passwordHash = await bcryptjs_1.default.hash(DEV_ADMIN_PASSWORD, 12);
            devAdmin = new User_1.User({
                name: DEV_ADMIN_NAME,
                email: DEV_ADMIN_EMAIL,
                phone: DEV_ADMIN_PHONE,
                passwordHash: passwordHash,
                role: "admin",
                addresses: [
                    {
                        label: "Admin Office",
                        pincode: "521235",
                        city: "Tiruvuru",
                        state: "Andhra Pradesh",
                        addressLine: "Admin Office, Tiruvuru",
                        lat: 16.5, // Approximate coordinates for Tiruvuru
                        lng: 80.5,
                        isDefault: true,
                    },
                ],
            });
            await devAdmin.save();
            console.log("✅ Dev admin user created successfully");
            console.log(`📧 Email: ${DEV_ADMIN_EMAIL}`);
            console.log(`📱 Phone: ${DEV_ADMIN_PHONE}`);
            console.log(`🔑 Password: ${DEV_ADMIN_PASSWORD}`);
            console.log(`👤 Role: admin`);
            console.log(`🔐 isAdmin: true`);
        }
        else {
            // Update existing user to ensure admin status and correct password
            const passwordHash = await bcryptjs_1.default.hash(DEV_ADMIN_PASSWORD, 12);
            const updateData = {
                role: "admin",
                phone: DEV_ADMIN_PHONE,
                passwordHash: passwordHash,
                // Ensure admin has default address
                addresses: [
                    {
                        label: "Admin Office",
                        pincode: "521235",
                        city: "Tiruvuru",
                        state: "Andhra Pradesh",
                        addressLine: "Admin Office, Tiruvuru",
                        lat: 16.5, // Approximate coordinates for Tiruvuru
                        lng: 80.5,
                        isDefault: true,
                    },
                ],
            };
            await User_1.User.findByIdAndUpdate(devAdmin._id, updateData);
            console.log("✅ Dev admin user updated successfully");
            console.log(`📧 Email: ${DEV_ADMIN_EMAIL}`);
            console.log(`📱 Phone: ${DEV_ADMIN_PHONE}`);
            console.log(`🔑 Password: ${DEV_ADMIN_PASSWORD}`);
            console.log(`👤 Role: admin`);
            console.log(`🔐 isAdmin: true`);
        }
        console.log("🎯 Dev admin bootstrap completed");
    }
    catch (error) {
        console.error("❌ Error bootstrapping dev admin:", error);
        throw error;
    }
};
exports.bootstrapDevAdmin = bootstrapDevAdmin;
