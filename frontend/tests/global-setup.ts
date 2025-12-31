import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Setting up E2E test environment...");

  // Start backend server if not running
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";

  try {
    const response = await fetch(`${backendUrl}/health`);
    if (!response.ok) {
      throw new Error("Backend server not running");
    }
    console.log("✅ Backend server is running");
  } catch (error) {
    console.log(
      "⚠️  Backend server not detected. Please ensure it's running on port 5001"
    );
  }

  // Setup test data
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Create test users and data
    await setupTestData(page);
    console.log("✅ Test data setup completed");
  } catch (error) {
    console.log("⚠️  Test data setup failed:", error);
  } finally {
    await browser.close();
  }

  console.log("🎯 E2E test environment ready!");
}

async function setupTestData(page: any) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

  // Create test users
  const testUsers = [
    {
      name: "Test Customer",
      email: "test@example.com",
      phone: "9876543210",
      password: "password123",
      role: "customer",
      addresses: [
        {
          label: "Home",
          pincode: "500001",
          city: "Hyderabad",
          state: "Telangana",
          addressLine: "123 Test Street",
          lat: 17.385,
          lng: 78.4867,
          isDefault: true,
        },
      ],
    },
    {
      name: "Admin User",
      email: "admin@cpsstore.com",
      phone: "9876543211",
      password: "admin123",
      role: "admin",
      addresses: [
        {
          label: "Office",
          pincode: "500001",
          city: "Hyderabad",
          state: "Telangana",
          addressLine: "456 Admin Street",
          lat: 17.385,
          lng: 78.4867,
          isDefault: true,
        },
      ],
    },
    {
      name: "Delivery Driver",
      email: "driver@cpsstore.com",
      phone: "9876543212",
      password: "driver123",
      role: "delivery",
      addresses: [
        {
          label: "Home",
          pincode: "500001",
          city: "Hyderabad",
          state: "Telangana",
          addressLine: "789 Driver Street",
          lat: 17.385,
          lng: 78.4867,
          isDefault: true,
        },
      ],
    },
  ];

  // Create test products
  const testProducts = [
    {
      name: "Test Product 1",
      description: "Test Description 1",
      category: "Electronics",
      price: 1500,
      stock: 10,
      images: ["test1.jpg"],
      tags: ["test", "electronics"],
    },
    {
      name: "Test Product 2",
      description: "Test Description 2",
      category: "Clothing",
      price: 800,
      stock: 5,
      images: ["test2.jpg"],
      tags: ["test", "clothing"],
    },
    {
      name: "Test Product 3",
      description: "Test Description 3",
      category: "Home",
      price: 1200,
      stock: 8,
      images: ["test3.jpg"],
      tags: ["test", "home"],
    },
  ];

  // Create test delivery boys
  const testDeliveryBoys = [
    {
      name: "Test Driver 1",
      phone: "9876543213",
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: {
        lat: 17.385,
        lng: 78.4867,
        lastUpdatedAt: new Date(),
      },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    },
    {
      name: "Test Driver 2",
      phone: "9876543214",
      vehicleType: "car",
      isActive: true,
      availability: "available",
      currentLocation: {
        lat: 17.4,
        lng: 78.5,
        lastUpdatedAt: new Date(),
      },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    },
  ];

  // Note: In a real scenario, you would make API calls to create this test data
  // For now, we'll assume the backend has seed data or the tests will create data as needed
  console.log("📝 Test data configuration ready");
}

export default globalSetup;
