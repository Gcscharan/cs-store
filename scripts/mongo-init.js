// MongoDB initialization script for CS Store
db = db.getSiblingDB("cps_store");

// Create collections with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "phone", "passwordHash", "role"],
      properties: {
        name: { bsonType: "string" },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        },
        phone: { bsonType: "string", pattern: "^[0-9]{10}$" },
        passwordHash: { bsonType: "string" },
        role: { enum: ["customer", "admin", "delivery"] },
      },
    },
  },
});

db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "price", "category", "stock"],
      properties: {
        name: { bsonType: "string" },
        price: { bsonType: "number", minimum: 0 },
        category: { bsonType: "string" },
        stock: { bsonType: "number", minimum: 0 },
      },
    },
  },
});

db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "items", "totalAmount", "address"],
      properties: {
        userId: { bsonType: "objectId" },
        items: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["productId", "name", "price", "qty"],
            properties: {
              productId: { bsonType: "objectId" },
              name: { bsonType: "string" },
              price: { bsonType: "number", minimum: 0 },
              qty: { bsonType: "number", minimum: 1 },
            },
          },
        },
        totalAmount: { bsonType: "number", minimum: 0 },
        address: {
          bsonType: "object",
          required: ["pincode", "city", "state", "addressLine"],
          properties: {
            pincode: { bsonType: "string" },
            city: { bsonType: "string" },
            state: { bsonType: "string" },
            addressLine: { bsonType: "string" },
          },
        },
      },
    },
  },
});

db.createCollection("deliveryboys", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "phone", "vehicleType"],
      properties: {
        name: { bsonType: "string" },
        phone: { bsonType: "string", pattern: "^[0-9]{10}$" },
        vehicleType: { enum: ["bike", "car", "scooter"] },
      },
    },
  },
});

db.createCollection("pincodes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["pincode", "city", "state"],
      properties: {
        pincode: { bsonType: "string" },
        city: { bsonType: "string" },
        state: { bsonType: "string" },
      },
    },
  },
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

db.products.createIndex({ name: "text", description: "text", tags: "text" });
db.products.createIndex({ category: 1 });
db.products.createIndex({ price: 1 });
db.products.createIndex({ stock: 1 });

db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ orderStatus: 1 });
db.orders.createIndex({ paymentStatus: 1 });
db.orders.createIndex({ createdAt: -1 });
db.orders.createIndex({ deliveryBoyId: 1 });

db.deliveryboys.createIndex({ phone: 1 }, { unique: true });
db.deliveryboys.createIndex({ isActive: 1 });
db.deliveryboys.createIndex({ availability: 1 });

db.pincodes.createIndex({ pincode: 1 }, { unique: true });
db.pincodes.createIndex({ state: 1 });
db.pincodes.createIndex({ city: 1 });

// Insert sample data for development
if (db.users.countDocuments() === 0) {
  // Insert sample admin user
  db.users.insertOne({
    name: "Admin User",
    email: "admin@cpsstore.com",
    phone: "9876543210",
    passwordHash:
      "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
    role: "admin",
    addresses: [
      {
        label: "Office",
        pincode: "500001",
        city: "Hyderabad",
        state: "Telangana",
        addressLine: "123 Admin Street",
        lat: 17.385,
        lng: 78.4867,
        isDefault: true,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert sample delivery boy
  db.deliveryboys.insertOne({
    name: "Test Driver",
    phone: "9876543211",
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert sample products
  db.products.insertMany([
    {
      name: "Sample Product 1",
      description: "This is a sample product for testing",
      category: "Electronics",
      price: 1500,
      stock: 10,
      images: ["sample1.jpg"],
      tags: ["electronics", "sample"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Sample Product 2",
      description: "Another sample product for testing",
      category: "Clothing",
      price: 800,
      stock: 5,
      images: ["sample2.jpg"],
      tags: ["clothing", "sample"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  // Insert sample pincodes
  db.pincodes.insertMany([
    { pincode: "500001", city: "Hyderabad", state: "Telangana" },
    { pincode: "500002", city: "Hyderabad", state: "Telangana" },
    { pincode: "500003", city: "Hyderabad", state: "Telangana" },
    { pincode: "500004", city: "Hyderabad", state: "Telangana" },
    { pincode: "500005", city: "Hyderabad", state: "Telangana" },
  ]);
}

print("MongoDB initialization completed successfully!");
