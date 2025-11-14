// Find who owns order 2761bc
const mongoose = require('mongoose');
require('dotenv').config();

async function findOrderOwner() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find all orders and filter for ones ending with 2761bc
    const allOrders = await Order.find({});
    const orders = allOrders.filter(o => o._id.toString().endsWith('2761bc'));
    
    console.log(`🔍 Orders ending with "2761bc": ${orders.length}\n`);

    for (const order of orders) {
      console.log(`📦 Order ${order._id}:`);
      console.log(`   Order Status: ${order.orderStatus}`);
      console.log(`   Delivery Status: ${order.deliveryStatus}`);
      console.log(`   Delivery Boy ID: ${order.deliveryBoyId}`);
      console.log(`   Amount: ₹${order.totalAmount}`);
      
      if (order.deliveryBoyId) {
        const deliveryBoy = await DeliveryBoy.findById(order.deliveryBoyId);
        if (deliveryBoy) {
          console.log(`   Assigned to: ${deliveryBoy.name} (DeliveryBoy ID: ${deliveryBoy._id})`);
          
          const user = await User.findById(deliveryBoy.userId);
          if (user) {
            console.log(`   User ID: ${user._id}`);
            console.log(`   User Phone: ${user.phone}`);
            console.log(`   User Role: ${user.role}`);
          }
        }
      } else {
        console.log(`   ⚠️  No delivery boy assigned`);
      }
      console.log('');
    }

    // Now find the real Raju's user credentials
    console.log('\n👤 Raju\'s Login Details:\n');
    const raju = await DeliveryBoy.findOne({ name: /raju/i });
    if (raju) {
      const rajuUser = await User.findById(raju.userId);
      console.log(`✅ Raju should login with:`);
      console.log(`   Phone: ${rajuUser.phone}`);
      console.log(`   User ID: ${rajuUser._id}`);
      console.log(`   DeliveryBoy ID: ${raju._id}\n`);
      
      // Check Raju's orders
      const rajuOrders = await Order.find({
        deliveryBoyId: raju._id,
        orderStatus: { $nin: ['cancelled', 'delivered'] }
      });
      console.log(`   Raju has ${rajuOrders.length} orders assigned`);
      rajuOrders.forEach(o => {
        console.log(`     - Order ${o._id}: ₹${o.totalAmount}`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

findOrderOwner();
