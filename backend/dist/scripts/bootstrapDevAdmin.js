"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapDevAdmin = void 0;
const logger_1 = require("../utils/logger");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const DEV_ADMIN_EMAIL = "gcs.charan@gmail.com";
const DEV_ADMIN_PASSWORD = "Gcs@2004";
const DEV_ADMIN_NAME = "Admin";
const DEV_ADMIN_PHONE = "9391795162";
// Seed test customer user (non-admin)
const DEV_TEST_USER_EMAIL = "test.user@example.com";
const DEV_TEST_USER_PASSWORD = "Test@1234";
const DEV_TEST_USER_NAME = "Test User";
const DEV_TEST_USER_PHONE = "9000000000";
// Seed test delivery boy
const DEV_TEST_DELIVERY_NAME = "Test Delivery Boy";
const DEV_TEST_DELIVERY_PHONE = "9000000001";
const bootstrapDevAdmin = async () => {
    try {
        // Only run in development
        if (process.env.NODE_ENV === "production") {
            logger_1.logger.info("⚠️  Skipping dev admin bootstrap in production");
            return;
        }
        logger_1.logger.info("🔧 Bootstrapping dev admin user and test data...");
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
                        postal_district: "Krishna",
                        admin_district: "NTR",
                        addressLine: "Admin Office, Tiruvuru",
                        lat: 16.5, // Approximate coordinates for Tiruvuru
                        lng: 80.5,
                        isDefault: true,
                    },
                ],
            });
            await devAdmin.save();
            logger_1.logger.info("✅ Dev admin user created successfully");
            logger_1.logger.info(`📧 Email: ${DEV_ADMIN_EMAIL}`);
            logger_1.logger.info(`📱 Phone: ${DEV_ADMIN_PHONE}`);
            logger_1.logger.info(`🔑 Password: ${DEV_ADMIN_PASSWORD}`);
            logger_1.logger.info(`👤 Role: admin`);
            logger_1.logger.info(`🔐 isAdmin: true`);
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
                        postal_district: "Krishna",
                        admin_district: "NTR",
                        addressLine: "Admin Office, Tiruvuru",
                        lat: 16.5, // Approximate coordinates for Tiruvuru
                        lng: 80.5,
                        isDefault: true,
                    },
                ],
            };
            await User_1.User.findByIdAndUpdate(devAdmin._id, updateData);
            logger_1.logger.info("✅ Dev admin user updated successfully");
            logger_1.logger.info(`📧 Email: ${DEV_ADMIN_EMAIL}`);
            logger_1.logger.info(`📱 Phone: ${DEV_ADMIN_PHONE}`);
            logger_1.logger.info(`🔑 Password: ${DEV_ADMIN_PASSWORD}`);
            logger_1.logger.info(`👤 Role: admin`);
            logger_1.logger.info(`🔐 isAdmin: true`);
        }
        // QA constraint: keep dev bootstrap limited to a single deterministic user.
        logger_1.logger.info("🎯 Dev admin bootstrap completed (single-user mode)");
        return;
    }
    catch (error) {
        logger_1.logger.error("❌ Error bootstrapping dev admin:", error);
        throw error;
    }
};
exports.bootstrapDevAdmin = bootstrapDevAdmin;
