// Check if orders are assigned to Raju in the database
const mongoose = require('mongoose');
require('dotenv').config();

async function checkRajuOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

    // Find Raju
    const raju = await DeliveryBoy.findOne({ name: /raju/i });
    
    if (!raju) {
      console.log('❌ Raju not found in database');
      console.log('\nSearching for all delivery boys...');
      const allDeliveryBoys = await DeliveryBoy.find().select('name phone isActive');
      console.log('Available delivery boys:');
      allDeliveryBoys.forEach(db => {
        console.log(`  - ${db.name} (${db._id}) - Active: ${db.isActive}`);
      });
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found Raju in database:`);
    console.log(`   ID: ${raju._id}`);
    console.log(`   Name: ${raju.name}`);
    console.log(`   Phone: ${raju.phone}`);
    console.log(`   Active: ${raju.isActive}`);
    console.log(`   Current Load: ${raju.currentLoad}`);
    console.log(`   Assigned Orders: ${raju.assignedOrders?.length || 0}\n`);

    // Find ALL orders assigned to Raju (including completed ones)
    const allOrders = await Order.find({
      deliveryBoyId: raju._id
    });
    
    console.log(`📦 TOTAL orders ever assigned to Raju: ${allOrders.length}`);
    allOrders.forEach(order => {
      console.log(`  - Order ${order._id}: orderStatus=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}`);
    });
    console.log('');

    // Find active orders assigned to Raju
    const orders = await Order.find({
      deliveryBoyId: raju._id,
      orderStatus: { $nin: ['cancelled', 'delivered'] }
    });

    console.log(`📦 Orders assigned to Raju: ${orders.length}\n`);

    if (orders.length === 0) {
      console.log('⚠️  No active orders found for Raju');
      
      // Check if there are any orders in confirmed status that could be assigned
      const confirmedOrders = await Order.find({
        orderStatus: 'confirmed',
        deliveryStatus: 'unassigned'
      }).limit(5);
      
      console.log(`\n📋 Confirmed orders waiting for assignment: ${confirmedOrders.length}`);
      confirmedOrders.forEach(order => {
        console.log(`  - Order ${order._id}: status=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}`);
      });
    } else {
      orders.forEach(order => {
        console.log(`📦 Order ${order._id}:`);
        console.log(`   Customer ID: ${order.userId}`);
        console.log(`   Order Status: ${order.orderStatus}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);
        console.log(`   Delivery Boy ID: ${order.deliveryBoyId}`);
        console.log(`   Amount: ₹${order.totalAmount}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('');
      });
    }

    await mongoose.disconnect();
    console.log('✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRajuOrders();
