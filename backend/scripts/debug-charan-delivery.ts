import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI environment variable is required");
  process.exit(1);
}

async function debug() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log("✅ Connected to MongoDB\n");

    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model("DeliveryBoy", new mongoose.Schema({}, { strict: false }));
    const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));
    const Route = mongoose.model("PersistedRoute", new mongoose.Schema({}, { strict: false }));

    // 1. Find charan user
    console.log("🔍 Step 1: Finding 'charan' user...");
    const charanUser: any = await User.findOne({
      $or: [
        { name: { $regex: "charan", $options: "i" } },
        { email: { $regex: "charan", $options: "i" } },
      ],
      role: "delivery",
    }).lean();

    if (!charanUser) {
      console.log("❌ No delivery user named 'charan' found");
      
      // List all delivery users
      const allDeliveryUsers: any[] = await User.find({ role: "delivery" }).lean();
      console.log("\n📋 All delivery users:");
      allDeliveryUsers.forEach((u: any) => {
        console.log(`  - ${u._id}: ${u.name} (${u.email}) - status: ${u.status}`);
      });
    } else {
      console.log(`✅ Found charan user:`);
      console.log(`   _id: ${charanUser._id}`);
      console.log(`   name: ${charanUser.name}`);
      console.log(`   email: ${charanUser.email}`);
      console.log(`   phone: ${charanUser.phone}`);
      console.log(`   status: ${charanUser.status}`);
    }

    // 2. Find DeliveryBoy record for charan
    console.log("\n🔍 Step 2: Finding DeliveryBoy record...");
    let deliveryBoy: any = null;
    
    if (charanUser) {
      deliveryBoy = await DeliveryBoy.findOne({
        $or: [
          { userId: charanUser._id },
          { phone: charanUser.phone },
          { email: charanUser.email },
        ],
      }).lean();
    }

    if (!deliveryBoy) {
      console.log("❌ No DeliveryBoy record found for charan");
      
      // List all delivery boys
      const allDeliveryBoys: any[] = await DeliveryBoy.find({}).lean();
      console.log("\n📋 All DeliveryBoy records:");
      allDeliveryBoys.forEach((db: any) => {
        console.log(`  - ${db._id}: ${db.name} (${db.email}) - userId: ${db.userId}, isActive: ${db.isActive}, availability: ${db.availability}`);
      });
    } else {
      console.log(`✅ Found DeliveryBoy record:`);
      console.log(`   _id: ${deliveryBoy._id}`);
      console.log(`   name: ${deliveryBoy.name}`);
      console.log(`   userId: ${deliveryBoy.userId}`);
      console.log(`   isActive: ${deliveryBoy.isActive}`);
      console.log(`   availability: ${deliveryBoy.availability}`);
      console.log(`   vehicleType: ${deliveryBoy.vehicleType}`);
    }

    // 3. Find ALL routes (including completed/cancelled)
    console.log("\n🔍 Step 3: Finding ALL routes...");
    const allRoutes: any[] = await Route.find({}).sort({ createdAt: -1 }).limit(20).lean();
    console.log(`Found ${allRoutes.length} routes (showing last 20)`);

    for (const route of allRoutes) {
      console.log(`\n  Route: ${route.routeId}`);
      console.log(`  Status: ${route.status}`);
      console.log(`  DeliveryBoyId: ${route.deliveryBoyId}`);
      console.log(`  OrderIds count: ${route.orderIds?.length || 0}`);
      console.log(`  CreatedAt: ${route.createdAt}`);
    }

    // Check the specific route mentioned in error
    console.log("\n🔍 Step 3b: Checking route AUTO-bd3a53a73d30...");
    const specificRoute: any = await Route.findOne({ routeId: "AUTO-bd3a53a73d30" }).lean();
    if (specificRoute) {
      console.log(`Found route AUTO-bd3a53a73d30:`);
      console.log(`  Status: ${specificRoute.status}`);
      console.log(`  DeliveryBoyId: ${specificRoute.deliveryBoyId}`);
      console.log(`  OrderIds: ${JSON.stringify(specificRoute.orderIds?.slice(0, 5))}`);
    } else {
      console.log("Route AUTO-bd3a53a73d30 not found");
    }

    // Also check routes assigned to charan specifically
    console.log("\n🔍 Step 3c: Finding routes assigned to charan's DeliveryBoy._id...");
    const routeQuery: any = { 
      deliveryBoyId: deliveryBoy?._id 
    };

    const activeRoutes: any[] = await Route.find(routeQuery).lean();
    console.log(`Found ${activeRoutes.length} routes for charan's DeliveryBoy._id: ${deliveryBoy?._id}`);

    for (const route of activeRoutes) {
      console.log(`\n  Route: ${route.routeId}`);
      console.log(`  Status: ${route.status}`);
      console.log(`  DeliveryBoyId: ${route.deliveryBoyId}`);
      console.log(`  OrderIds: ${JSON.stringify(route.orderIds?.slice(0, 5))}...`);
    }

    // 4. Check ALL orders in database
    console.log("\n🔍 Step 4: Checking ALL orders...");
    const allOrders: any[] = await Order.find({}).sort({ createdAt: -1 }).limit(20).lean();
    console.log(`Found ${allOrders.length} orders total (showing last 20)`);

    for (const order of allOrders) {
      console.log(`\n  Order ${order._id}:`);
      console.log(`    orderStatus: ${order.orderStatus}`);
      console.log(`    deliveryStatus: ${order.deliveryStatus}`);
      console.log(`    deliveryBoyId: ${order.deliveryBoyId}`);
      console.log(`    deliveryPartnerId: ${order.deliveryPartnerId}`);
    }

    // 5. Check PACKED orders (eligible for assignment)
    console.log("\n🔍 Step 5: Checking PACKED orders...");
    const packedOrders: any[] = await Order.find({
      orderStatus: { $in: ["PACKED", "packed"] }
    }).lean();
    console.log(`Found ${packedOrders.length} PACKED orders`);

    for (const order of packedOrders.slice(0, 5)) {
      console.log(`\n  PACKED Order ${order._id}:`);
      console.log(`    deliveryBoyId: ${order.deliveryBoyId}`);
      console.log(`    deliveryPartnerId: ${order.deliveryPartnerId}`);
    }

    // 7. Check ALL delivery boys
    console.log("\n🔍 Step 7: Checking ALL delivery boys...");
    const allDeliveryBoys: any[] = await DeliveryBoy.find({}).lean();
    console.log(`Found ${allDeliveryBoys.length} delivery boys`);

    for (const db of allDeliveryBoys) {
      console.log(`\n  DeliveryBoy ${db._id}:`);
      console.log(`    name: ${db.name}`);
      console.log(`    userId: ${db.userId}`);
      console.log(`    isActive: ${db.isActive}`);
      console.log(`    availability: ${db.availability}`);
      console.log(`    vehicleType: ${db.vehicleType}`);
    }

    // 8. Check who owns deliveryBoyId 69678e91fdefeff69393e42a
    console.log("\n🔍 Step 8: Checking who owns the assigned orders...");
    const assignedDeliveryBoy: any = await DeliveryBoy.findById("69678e91fdefeff69393e42a").lean();
    if (assignedDeliveryBoy) {
      console.log(`DeliveryBoy 69678e91fdefeff69393e42a:`);
      console.log(`  name: ${assignedDeliveryBoy.name}`);
      console.log(`  userId: ${assignedDeliveryBoy.userId}`);
      console.log(`  isActive: ${assignedDeliveryBoy.isActive}`);
    } else {
      console.log("DeliveryBoy 69678e91fdefeff69393e42a not found - orders may be orphaned");
    }

    // 9. Summary and fix recommendation
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`charan DeliveryBoy._id: ${deliveryBoy?._id}`);
    console.log(`charan User._id: ${charanUser?._id}`);
    console.log(`Total PACKED orders: ${packedOrders.length}`);
    console.log(`Unassigned PACKED orders: ${packedOrders.filter((o: any) => !o.deliveryBoyId).length}`);
    console.log(`Orders assigned to charan: 0`);
    console.log(`Total routes: 0`);

    // 10. Verify orders are now assigned to charan
    console.log("\n� Step 10: Verifying orders assigned to charan...");
    
    if (charanUser && deliveryBoy) {
      // Query matching what getDeliveryOrders does
      const orders: any[] = await Order.find({
        $or: [
          { deliveryBoyId: deliveryBoy._id },
          { deliveryBoyId: charanUser._id },
          { deliveryPartnerId: charanUser._id },
        ],
      }).lean();

      console.log(`Found ${orders.length} orders matching deliveryBoyId/deliveryPartnerId`);

      for (const order of orders.slice(0, 10)) {
        console.log(`\n  Order ${order._id}:`);
        console.log(`    orderStatus: ${order.orderStatus}`);
        console.log(`    deliveryStatus: ${order.deliveryStatus}`);
        console.log(`    deliveryBoyId: ${order.deliveryBoyId}`);
        console.log(`    deliveryPartnerId: ${order.deliveryPartnerId}`);
      }

      // Check if orders are in the right status for dashboard
      const dashboardStatuses = ["CONFIRMED", "PACKED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "confirmed", "packed", "assigned", "picked_up", "in_transit", "out_for_delivery", "OUT_FOR_DELIVERY"];
      const eligibleOrders = orders.filter((o: any) => dashboardStatuses.includes(o.orderStatus));
      console.log(`\n✅ Orders eligible for dashboard: ${eligibleOrders.length}`);
    }

    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
}

debug();
