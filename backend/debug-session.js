// Debug what's happening with the session
const mongoose = require('mongoose');
require('dotenv').config();

async function debugSession() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    console.log('🔍 DEBUGGING THE ISSUE:\n');
    console.log('─'.repeat(80));

    // The user ID from the logs
    const userId = '690c2a74d10432546bf71210';
    
    console.log(`\n1️⃣ Looking up User ID from logs: ${userId}\n`);
    
    const user = await User.findById(userId);
    console.log(`✅ User found:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);

    console.log(`\n2️⃣ Looking up DeliveryBoy record with this userId:\n`);
    
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
    
    if (!deliveryBoy) {
      console.log(`❌ No DeliveryBoy found with userId: ${user._id}`);
      console.log(`\n🔍 Let's find ALL delivery boys:\n`);
      const allDB = await DeliveryBoy.find({});
      allDB.forEach(db => {
        console.log(`  - ${db.name} (${db._id}): userId = ${db.userId || 'UNDEFINED'}`);
      });
    } else {
      console.log(`✅ DeliveryBoy found:`);
      console.log(`   Name: ${deliveryBoy.name}`);
      console.log(`   ID: ${deliveryBoy._id}`);
      console.log(`   userId: ${deliveryBoy.userId}`);
      console.log(`   isActive: ${deliveryBoy.isActive}`);

      // But the logs show it's fetching for Test Delivery Boy!
      console.log(`\n❌ BUT... backend logs show fetching for:`);
      console.log(`   "Test Delivery Boy" (68e7e2a9b77694c5433e7bde)`);
      console.log(`\n🔍 This means the API is not finding the correct DeliveryBoy!`);

      // Let's check the Test Delivery Boy
      const testDB = await DeliveryBoy.findById('68e7e2a9b77694c5433e7bde');
      console.log(`\n🔍 Test Delivery Boy details:`);
      console.log(`   Name: ${testDB?.name || 'N/A'}`);
      console.log(`   userId: ${testDB?.userId || 'UNDEFINED'}`);
      console.log(`   isActive: ${testDB?.isActive}`);

      if (!testDB?.userId) {
        console.log(`\n💡 SOLUTION: Test Delivery Boy has UNDEFINED userId!`);
        console.log(`   The API query "DeliveryBoy.findOne({ userId: user.userId })" returns NULL`);
        console.log(`   when userId is undefined, so it fallsback to first match!`);
        console.log(`\n🔧 We need to either:`);
        console.log(`   1. Delete Test Delivery Boy records`);
        console.log(`   2. OR set their userId properly`);
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

debugSession();
