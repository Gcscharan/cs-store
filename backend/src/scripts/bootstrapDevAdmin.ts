import { logger } from '../utils/logger';
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";

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

export const bootstrapDevAdmin = async (): Promise<void> => {
  try {
    // Only run in development
    if (process.env.NODE_ENV === "production") {
      logger.info("⚠️  Skipping dev admin bootstrap in production");
      return;
    }

    logger.info("🔧 Bootstrapping dev admin user and test data...");

    // Check if dev admin user exists
    let devAdmin = await User.findOne({ email: DEV_ADMIN_EMAIL });

    if (!devAdmin) {
      // Create new dev admin user
      const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);

      devAdmin = new User({
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
      logger.info("✅ Dev admin user created successfully");
      logger.info(`📧 Email: ${DEV_ADMIN_EMAIL}`);
      logger.info(`📱 Phone: ${DEV_ADMIN_PHONE}`);
      logger.info(`🔑 Password: [REDACTED - check .env or scripts]`);
      logger.info(`👤 Role: admin`);
      logger.info(`🔐 isAdmin: true`);
    } else {
      // Update existing user to ensure admin status and correct password
      const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);

      const updateData: any = {
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

      await User.findByIdAndUpdate(devAdmin._id, updateData);
      logger.info("✅ Dev admin user updated successfully");
      logger.info(`📧 Email: ${DEV_ADMIN_EMAIL}`);
      logger.info(`📱 Phone: ${DEV_ADMIN_PHONE}`);
      logger.info(`🔑 Password: [REDACTED - check .env or scripts]`);
      logger.info(`👤 Role: admin`);
      logger.info(`🔐 isAdmin: true`);
    }

    // QA constraint: keep dev bootstrap limited to a single deterministic user.
    logger.info("🎯 Dev admin bootstrap completed (single-user mode)");
    return;
  } catch (error) {
    logger.error("❌ Error bootstrapping dev admin:", error);
    throw error;
  }
};
