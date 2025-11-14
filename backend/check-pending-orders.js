// Check orders that need assignment
const mongoose = require('mongoose');
require('dotenv').config();

async function checkPendingOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    // Find all confirmed orders waiting for assignment
    const confirmedOrders = await Order.find({
      orderStatus: 'confirmed',
      deliveryStatus: 'unassigned'
    }).sort({ createdAt: -1 });

    console.log(`📋 Confirmed orders waiting for assignment: ${confirmedOrders.length}\n`);
    
    if (confirmedOrders.length > 0) {
      confirmedOrders.forEach(order => {
        console.log(`📦 Order ${order._id}:`);
        console.log(`   Order Status: ${order.orderStatus}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);
        console.log(`   Amount: ₹${order.totalAmount}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('');
      });
    }

    // Find all orders in pending status
    const pendingOrders = await Order.find({
      orderStatus: 'pending'
    }).sort({ createdAt: -1 });

    console.log(`📋 Pending orders (waiting for admin accept): ${pendingOrders.length}\n`);
    
    if (pendingOrders.length > 0) {
      pendingOrders.forEach(order => {
        console.log(`📦 Order ${order._id}:`);
        console.log(`   Order Status: ${order.orderStatus}`);
        console.log(`   Payment Status: ${order.paymentStatus}`);
        console.log(`   Amount: ₹${order.totalAmount}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('');
      });
    }

    // Check all delivery boys and their assignments
    const allDeliveryBoys = await DeliveryBoy.find({ isActive: true });
    console.log(`\n🚴 Active Delivery Partners: ${allDeliveryBoys.length}\n`);
    
    for (const db of allDeliveryBoys) {
      const assignedCount = await Order.countDocuments({
        deliveryBoyId: db._id,
        orderStatus: { $nin: ['cancelled', 'delivered'] }
      });
      
      console.log(`  ${db.name} (${db._id}):`);
      console.log(`    - Current Load: ${db.currentLoad}`);
      console.log(`    - Active Orders: ${assignedCount}`);
      console.log('');
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

checkPendingOrders();
