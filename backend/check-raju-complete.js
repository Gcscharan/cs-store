// Complete check of Raju's account and orders
const mongoose = require('mongoose');
require('dotenv').config();

async function checkRajuComplete() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

    console.log('═'.repeat(80));
    console.log('🔍 CHECKING RAJU\'S ACCOUNT\n');

    // Find Raju's user account
    const rajuUser = await User.findOne({ email: 'raju@gmail.com' });
    
    if (!rajuUser) {
      console.log('❌ ERROR: Raju\'s user account NOT found!');
      console.log('   Email: raju@gmail.com not in database\n');
      
      // List all delivery-related users
      const deliveryUsers = await User.find({ role: 'delivery' });
      console.log(`📋 Found ${deliveryUsers.length} delivery users:`);
      deliveryUsers.forEach(u => {
        console.log(`   - ${u.email || u.phone} (ID: ${u._id})`);
      });
      
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('✅ Raju\'s User Account:');
    console.log(`   User ID: ${rajuUser._id}`);
    console.log(`   Email: ${rajuUser.email}`);
    console.log(`   Phone: ${rajuUser.phone}`);
    console.log(`   Role: ${rajuUser.role}`);
    console.log(`   Has Password: ${rajuUser.password ? 'Yes (hashed)' : 'No'}\n`);

    // Find Raju's delivery boy profile
    const rajuDB = await DeliveryBoy.findOne({ userId: rajuUser._id, isActive: true });
    
    if (!rajuDB) {
      console.log('❌ ERROR: Raju\'s DeliveryBoy profile NOT found or NOT active!');
      
      // Check if profile exists but is inactive
      const inactiveDB = await DeliveryBoy.findOne({ userId: rajuUser._id });
      if (inactiveDB) {
        console.log(`   Found INACTIVE profile: ${inactiveDB._id}`);
        console.log(`   Name: ${inactiveDB.name}`);
        console.log(`   isActive: ${inactiveDB.isActive}\n`);
      }
      
      // List all active delivery boys
      const allDBs = await DeliveryBoy.find({ isActive: true });
      console.log(`📋 Found ${allDBs.length} active delivery boys:`);
      allDBs.forEach(db => {
        console.log(`   - ${db.name} (ID: ${db._id}, userId: ${db.userId || 'undefined'})`);
      });
      
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('✅ Raju\'s DeliveryBoy Profile:');
    console.log(`   DeliveryBoy ID: ${rajuDB._id}`);
    console.log(`   Name: ${rajuDB.name}`);
    console.log(`   Phone: ${rajuDB.phone}`);
    console.log(`   Email: ${rajuDB.email}`);
    console.log(`   Vehicle: ${rajuDB.vehicleType}`);
    console.log(`   isActive: ${rajuDB.isActive}`);
    console.log(`   Availability: ${rajuDB.availability}`);
    console.log(`   Current Load: ${rajuDB.currentLoad}\n`);

    // Find orders assigned to Raju
    const orders = await Order.find({
      deliveryBoyId: rajuDB._id,
      orderStatus: { $nin: ['cancelled', 'delivered'] }
    });

    console.log('═'.repeat(80));
    console.log(`📦 ORDERS ASSIGNED TO RAJU: ${orders.length}\n`);

    if (orders.length === 0) {
      console.log('❌ No orders assigned to Raju!\n');
      
      // Check all orders
      const allOrders = await Order.find({
        orderStatus: { $nin: ['cancelled', 'delivered'] }
      });
      console.log(`📋 Total active orders in system: ${allOrders.length}`);
      
      allOrders.forEach(order => {
        console.log(`   - Order ${order._id}:`);
        console.log(`     Status: ${order.orderStatus} / ${order.deliveryStatus}`);
        console.log(`     DeliveryBoyId: ${order.deliveryBoyId || 'unassigned'}`);
      });
    } else {
      orders.forEach((order, idx) => {
        console.log(`${idx + 1}. Order ID: ${order._id}`);
        console.log(`   Status: ${order.orderStatus}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);
        console.log(`   Total: ₹${order.totalAmount}`);
        console.log(`   DeliveryBoyId: ${order.deliveryBoyId}`);
        console.log(`   Matches Raju: ${order.deliveryBoyId?.toString() === rajuDB._id.toString() ? '✅ Yes' : '❌ No'}`);
        console.log('');
      });
    }

    console.log('═'.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`✅ User Account: Found (${rajuUser._id})`);
    console.log(`✅ DeliveryBoy Profile: Found (${rajuDB._id})`);
    console.log(`✅ Profile Active: ${rajuDB.isActive}`);
    console.log(`📦 Orders Assigned: ${orders.length}`);
    
    if (orders.length > 0) {
      const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      console.log(`💰 Total Order Value: ₹${totalValue}`);
    }

    console.log('\n═'.repeat(80));
    console.log('\n🔑 LOGIN CREDENTIALS:\n');
    console.log(`Email: ${rajuUser.email}`);
    console.log(`Password: 123456 (or use OTP: ${rajuUser.phone})`);
    console.log('\n📱 TEST LOGIN:\n');
    console.log(`curl -X POST http://localhost:5001/api/delivery/auth/login \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"email":"${rajuUser.email}","password":"123456"}'`);
    console.log('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRajuComplete();
