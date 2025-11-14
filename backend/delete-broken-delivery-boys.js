// Delete or deactivate broken delivery boy records
const mongoose = require('mongoose');
require('dotenv').config();

async function deleteBrokenDeliveryBoys() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

    // Find delivery boys with undefined or null userId
    const brokenDBs = await DeliveryBoy.find({
      $or: [
        { userId: null },
        { userId: undefined },
        { userId: { $exists: false } }
      ]
    });

    console.log(`🔍 Found ${brokenDBs.length} delivery boy records with undefined userId:\n`);

    for (const db of brokenDBs) {
      console.log(`─`.repeat(80));
      console.log(`\n📦 ${db.name} (${db._id}):`);
      console.log(`   userId: ${db.userId || 'UNDEFINED'}`);
      console.log(`   isActive: ${db.isActive}`);
      
      // Check if they have orders
      const orderCount = await Order.countDocuments({ deliveryBoyId: db._id });
      console.log(`   Orders assigned: ${orderCount}`);

      if (orderCount > 0) {
        console.log(`\n   ⚠️  HAS ORDERS! Need to reassign before deleting.`);
        const orders = await Order.find({ deliveryBoyId: db._id });
        orders.forEach(order => {
          console.log(`      - Order ${order._id}: ${order.orderStatus}`);
        });

        // Deactivate instead of delete
        db.isActive = false;
        await db.save();
        console.log(`   ✅ DEACTIVATED (has orders)`);
      } else {
        console.log(`\n   ✅ No orders assigned - SAFE TO DELETE`);
        await DeliveryBoy.findByIdAndDelete(db._id);
        console.log(`   ✅ DELETED`);
      }
    }

    console.log(`\n${'─'.repeat(80)}\n`);
    console.log('✅ Cleanup complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Hard refresh Raju\'s dashboard (Ctrl+Shift+R)');
    console.log('2. You should now see all 3 orders correctly!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

deleteBrokenDeliveryBoys();
