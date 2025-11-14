// Verify the exact state of these 3 orders
const mongoose = require('mongoose');
require('dotenv').config();

async function verifyExactOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    // Find Raju
    const raju = await DeliveryBoy.findOne({ name: /raju/i });
    console.log(`✅ Raju DeliveryBoy ID: ${raju._id}`);
    console.log(`   Raju User ID: ${raju.userId}\n`);

    const orderIds = [
      '690cde359f8b57fe8e15c604',
      '690cdbe940df5e20c140c1aa',
      '690cddf79f8b57fe8e15c539'
    ];

    console.log('🔍 CHECKING EACH ORDER:\n');
    console.log('═'.repeat(80));

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId);
      
      if (!order) {
        console.log(`\n❌ Order ${orderId} NOT FOUND\n`);
        continue;
      }

      console.log(`\n📦 Order ${orderId}:`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      console.log(`   Order Status: ${order.orderStatus}`);
      console.log(`   Delivery Status: ${order.deliveryStatus}`);
      console.log(`   Delivery Boy ID (raw): ${order.deliveryBoyId}`);
      console.log(`   Delivery Boy ID (type): ${typeof order.deliveryBoyId}`);
      console.log(`   Raju's ID: ${raju._id}`);
      console.log(`   Match? ${order.deliveryBoyId?.toString() === raju._id.toString() ? '✅ YES' : '❌ NO'}`);
      
      if (order.deliveryBoyId?.toString() !== raju._id.toString()) {
        console.log(`\n   🔧 FIXING: Setting deliveryBoyId to ${raju._id}`);
        order.deliveryBoyId = raju._id;
        await order.save();
        console.log(`   ✅ FIXED!`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n🔍 NOW SIMULATING API QUERY:\n');

    const query = {
      deliveryBoyId: raju._id,
      orderStatus: { $nin: ['cancelled', 'delivered'] }
    };

    console.log('Query:', JSON.stringify(query, null, 2));

    const foundOrders = await Order.find(query).sort({ createdAt: -1 });

    console.log(`\n✅ API would return ${foundOrders.length} orders:\n`);

    foundOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ${order._id}:`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      console.log(`   Status: ${order.orderStatus}/${order.deliveryStatus}`);
      console.log(`   DeliveryBoyId: ${order.deliveryBoyId}`);
      console.log('');
    });

    console.log('═'.repeat(80));
    console.log('\n📝 Next Step: Hard refresh Raju\'s dashboard!');
    console.log('   Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyExactOrders();
