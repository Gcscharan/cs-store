"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapDevAdmin = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
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
            console.log("⚠️  Skipping dev admin bootstrap in production");
            return;
        }
        console.log("🔧 Bootstrapping dev admin user and test data...");
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
        // Seed regular test customer user
        let testUser = await User_1.User.findOne({ email: DEV_TEST_USER_EMAIL });
        const testUserPasswordHash = await bcryptjs_1.default.hash(DEV_TEST_USER_PASSWORD, 12);
        if (!testUser) {
            testUser = new User_1.User({
                name: DEV_TEST_USER_NAME,
                email: DEV_TEST_USER_EMAIL,
                phone: DEV_TEST_USER_PHONE,
                passwordHash: testUserPasswordHash,
                role: "customer",
                addresses: [],
            });
            await testUser.save();
            console.log("✅ Dev test customer user created successfully");
            console.log(`📧 Email: ${DEV_TEST_USER_EMAIL}`);
            console.log(`📱 Phone: ${DEV_TEST_USER_PHONE}`);
            console.log(`🔑 Password: ${DEV_TEST_USER_PASSWORD}`);
        }
        else {
            await User_1.User.findByIdAndUpdate(testUser._id, {
                name: DEV_TEST_USER_NAME,
                phone: DEV_TEST_USER_PHONE,
                passwordHash: testUserPasswordHash,
                role: "customer",
            });
            console.log("✅ Dev test customer user updated successfully");
            console.log(`📧 Email: ${DEV_TEST_USER_EMAIL}`);
            console.log(`📱 Phone: ${DEV_TEST_USER_PHONE}`);
            console.log(`🔑 Password: ${DEV_TEST_USER_PASSWORD}`);
        }
        // Seed test delivery boy
        let testDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ phone: DEV_TEST_DELIVERY_PHONE });
        if (!testDeliveryBoy) {
            testDeliveryBoy = new DeliveryBoy_1.DeliveryBoy({
                name: DEV_TEST_DELIVERY_NAME,
                phone: DEV_TEST_DELIVERY_PHONE,
                vehicleType: "bike",
                isActive: true,
                availability: "available",
                currentLocation: {
                    lat: 16.5,
                    lng: 80.5,
                    lastUpdatedAt: new Date(),
                },
                earnings: 0,
                completedOrdersCount: 0,
                assignedOrders: [],
                currentLoad: 0,
            });
            await testDeliveryBoy.save();
            console.log("✅ Dev test delivery boy created successfully");
            console.log(`👤 Name: ${DEV_TEST_DELIVERY_NAME}`);
            console.log(`📱 Phone: ${DEV_TEST_DELIVERY_PHONE}`);
        }
        else {
            await DeliveryBoy_1.DeliveryBoy.findByIdAndUpdate(testDeliveryBoy._id, {
                name: DEV_TEST_DELIVERY_NAME,
                vehicleType: "bike",
                isActive: true,
                availability: "available",
            });
            console.log("✅ Dev test delivery boy updated successfully");
            console.log(`👤 Name: ${DEV_TEST_DELIVERY_NAME}`);
            console.log(`📱 Phone: ${DEV_TEST_DELIVERY_PHONE}`);
        }
        console.log("🎯 Dev admin and test data bootstrap completed");
    }
    catch (error) {
        console.error("❌ Error bootstrapping dev admin:", error);
        throw error;
    }
};
exports.bootstrapDevAdmin = bootstrapDevAdmin;
