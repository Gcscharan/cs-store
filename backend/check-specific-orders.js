// Check specific orders for Raju
const mongoose = require('mongoose');
require('dotenv').config();

async function checkSpecificOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    // Find Raju
    const raju = await DeliveryBoy.findOne({ name: /raju/i });
    console.log(`✅ Raju ID: ${raju._id}\n`);

    const orderIds = [
      '690cde359f8b57fe8e15c604',
      '690cddf79f8b57fe8e15c539'
    ];

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId);
      
      if (!order) {
        console.log(`❌ Order ${orderId} NOT FOUND in database\n`);
        continue;
      }

      console.log(`📦 Order ${orderId}:`);
      console.log(`   Order Status: ${order.orderStatus}`);
      console.log(`   Delivery Status: ${order.deliveryStatus}`);
      console.log(`   Delivery Boy ID: ${order.deliveryBoyId}`);
      console.log(`   Assigned to Raju?: ${order.deliveryBoyId?.toString() === raju._id.toString() ? '✅ YES' : '❌ NO'}`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      console.log(`   Created: ${order.createdAt}`);
      
      // Check if it should appear in query
      const shouldAppear = order.deliveryBoyId?.toString() === raju._id.toString() 
        && order.orderStatus !== 'cancelled' 
        && order.orderStatus !== 'delivered';
      console.log(`   Should appear in dashboard?: ${shouldAppear ? '✅ YES' : '❌ NO'}`);
      console.log('');
    }

    // Now fetch what the API would return
    console.log('\n🔍 What API returns for Raju:\n');
    const apiOrders = await Order.find({
      deliveryBoyId: raju._id,
      orderStatus: { $nin: ['cancelled', 'delivered'] }
    }).select('_id orderStatus deliveryStatus totalAmount');

    console.log(`Found ${apiOrders.length} orders:\n`);
    apiOrders.forEach(order => {
      console.log(`  ✅ ${order._id}: status=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}, amount=₹${order.totalAmount}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkSpecificOrders();
