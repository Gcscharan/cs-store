// Get all delivery boy login credentials
const mongoose = require('mongoose');
require('dotenv').config();

async function getDeliveryCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('                    DELIVERY BOY LOGIN CREDENTIALS');
    console.log('='.repeat(80));
    console.log('');

    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

    // Find all delivery boys
    const deliveryBoys = await DeliveryBoy.find({ isActive: true }).sort({ name: 1 });

    for (const deliveryBoy of deliveryBoys) {
      const user = await User.findById(deliveryBoy.userId);
      
      if (!user) {
        console.log(`⚠️  ${deliveryBoy.name} - No user account found\n`);
        continue;
      }

      // Count orders
      const orderCount = await Order.countDocuments({
        deliveryBoyId: deliveryBoy._id,
        orderStatus: { $nin: ['cancelled', 'delivered'] }
      });

      console.log(`👤 ${deliveryBoy.name.toUpperCase()}`);
      console.log('─'.repeat(80));
      console.log(`   📱 Phone Number:     ${user.phone}`);
      console.log(`   🔑 Password:         Use OTP login OR check User model for password`);
      console.log(`   👤 User ID:          ${user._id}`);
      console.log(`   🚴 Delivery Boy ID:  ${deliveryBoy._id}`);
      console.log(`   📦 Active Orders:    ${orderCount}`);
      console.log(`   ✅ Status:           ${deliveryBoy.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   🏍️  Vehicle:          ${deliveryBoy.vehicleType || 'N/A'}`);
      console.log(`   📍 Current Load:     ${deliveryBoy.currentLoad || 0}`);
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('\n📝 LOGIN INSTRUCTIONS:');
    console.log('─'.repeat(80));
    console.log('1. Go to: http://localhost:3000/delivery/login');
    console.log('2. Enter the phone number above');
    console.log('3. Use OTP authentication or password if set');
    console.log('4. Dashboard will show assigned orders\n');

    console.log('='.repeat(80));
    console.log('\n🔍 DETAILED ORDER BREAKDOWN:\n');

    for (const deliveryBoy of deliveryBoys) {
      const orders = await Order.find({
        deliveryBoyId: deliveryBoy._id,
        orderStatus: { $nin: ['cancelled', 'delivered'] }
      });

      if (orders.length > 0) {
        console.log(`📦 ${deliveryBoy.name} - ${orders.length} order(s):`);
        orders.forEach(order => {
          console.log(`   • Order ${order._id}: ₹${order.totalAmount} (${order.orderStatus}/${order.deliveryStatus})`);
        });
        console.log('');
      }
    }

    console.log('='.repeat(80));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

getDeliveryCredentials();
