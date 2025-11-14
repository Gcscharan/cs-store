// Test what the API actually returns for Raju
const mongoose = require('mongoose');
require('dotenv').config();

async function testApiResponse() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find Raju
    const raju = await DeliveryBoy.findOne({ name: /raju/i });
    console.log(`✅ Raju DeliveryBoy ID: ${raju._id}`);
    console.log(`   User ID: ${raju.userId}\n`);

    // Find the User record for Raju
    const rajuUser = await User.findById(raju.userId);
    console.log(`✅ Raju User Record:`);
    console.log(`   User ID: ${rajuUser._id}`);
    console.log(`   Role: ${rajuUser.role}`);
    console.log(`   Phone: ${rajuUser.phone}\n`);

    // Simulate what the API endpoint does - exact same query
    console.log('🔍 Simulating API query:\n');
    console.log(`Query: Order.find({ deliveryBoyId: ${raju._id}, orderStatus: { $nin: ['cancelled', 'delivered'] } })\n`);

    const orders = await Order.find({
      deliveryBoyId: raju._id,
      orderStatus: { $nin: ["cancelled", "delivered"] },
    })
      .sort({ createdAt: -1 });

    console.log(`📦 API would return ${orders.length} orders:\n`);

    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ${order._id}:`);
      console.log(`   Order Number: ${order.orderNumber || 'N/A'}`);
      console.log(`   Order Status: ${order.orderStatus}`);
      console.log(`   Delivery Status: ${order.deliveryStatus}`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      console.log(`   Items: ${order.items?.length || 0}`);
      console.log(`   Customer ID: ${order.userId}`);
      console.log(`   Delivery Boy ID: ${order.deliveryBoyId}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log('');
    });

    // Check if there are orders with different statuses
    console.log('\n🔍 Checking all orders for Raju (including cancelled/delivered):\n');
    const allOrders = await Order.find({ deliveryBoyId: raju._id });
    console.log(`Total orders (all statuses): ${allOrders.length}`);
    allOrders.forEach(order => {
      console.log(`  - ${order._id}: status=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testApiResponse();
