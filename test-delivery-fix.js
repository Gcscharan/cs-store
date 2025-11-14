const mongoose = require("mongoose");
const { User } = require("./src/models/User");
const { DeliveryBoy } = require("./src/models/DeliveryBoy");

async function testDeliveryFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/dream-ecommerce");
    console.log("Connected to MongoDB");

    // Find or create a test user with delivery role
    let testUser = await User.findOne({ email: "delivery@test.com" });

    if (!testUser) {
      testUser = new User({
        name: "Test Delivery Boy",
        email: "delivery@test.com",
        phone: "9876543210",
        passwordHash: "hashedpassword",
        role: "delivery",
      });
      await testUser.save();
      console.log("Created test user with delivery role");
    } else {
      // Update existing user to delivery role
      testUser.role = "delivery";
      await testUser.save();
      console.log("Updated existing user to delivery role");
    }

    // Check if delivery boy record exists
    let deliveryBoy = await DeliveryBoy.findOne({ phone: testUser.phone });

    if (!deliveryBoy) {
      deliveryBoy = new DeliveryBoy({
        name: testUser.name,
        phone: testUser.phone,
        vehicleType: "bike",
        currentLocation: {
          lat: 0,
          lng: 0,
          lastUpdatedAt: new Date(),
        },
        availability: "offline",
        isActive: true,
        earnings: 0,
        completedOrdersCount: 0,
        assignedOrders: [],
      });
      await deliveryBoy.save();
      console.log("Created delivery boy record");
    } else {
      console.log("Delivery boy record already exists");
    }

    console.log("Test setup complete!");
    console.log("User:", {
      id: testUser._id,
      name: testUser.name,
      email: testUser.email,
      phone: testUser.phone,
      role: testUser.role,
    });
    console.log("Delivery Boy:", {
      id: deliveryBoy._id,
      name: deliveryBoy.name,
      phone: deliveryBoy.phone,
      vehicleType: deliveryBoy.vehicleType,
    });
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

testDeliveryFix();
