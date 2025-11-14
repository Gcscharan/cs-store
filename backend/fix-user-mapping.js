// Fix the user-to-deliveryboy mapping
const mongoose = require('mongoose');
require('dotenv').config();

async function fixUserMapping() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    // Find all users and delivery boys
    const allUsers = await User.find({ role: 'delivery' });
    const allDeliveryBoys = await DeliveryBoy.find({});

    console.log('🔍 Current User → DeliveryBoy Mappings:\n');
    console.log('─'.repeat(80));

    for (const user of allUsers) {
      const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
      console.log(`User: ${user.email || user.phone} (${user._id})`);
      if (deliveryBoy) {
        console.log(`  → Mapped to: ${deliveryBoy.name} (${deliveryBoy._id})`);
      } else {
        console.log(`  → ❌ No DeliveryBoy mapping found`);
      }
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log('\n🔍 All DeliveryBoy Records:\n');
    
    for (const db of allDeliveryBoys) {
      console.log(`DeliveryBoy: ${db.name} (${db._id})`);
      console.log(`  userId: ${db.userId}`);
      const user = await User.findById(db.userId);
      if (user) {
        console.log(`  → User: ${user.email || user.phone} (${user._id})`);
      } else {
        console.log(`  → ❌ User not found`);
      }
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log('\n🔧 FIXING THE MAPPING...\n');

    // Find the raju user by email
    const rajuUser = await User.findOne({ email: 'raju@gmail.com' });
    if (!rajuUser) {
      console.log('❌ User with email raju@gmail.com not found');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found Raju user: ${rajuUser._id} (${rajuUser.email})`);

    // Find the raju delivery boy
    const rajuDeliveryBoy = await DeliveryBoy.findOne({ name: /raju/i });
    if (!rajuDeliveryBoy) {
      console.log('❌ Raju delivery boy not found');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found Raju DeliveryBoy: ${rajuDeliveryBoy._id} (${rajuDeliveryBoy.name})`);

    // Check if mapping is correct
    if (rajuDeliveryBoy.userId.toString() === rajuUser._id.toString()) {
      console.log('\n✅ Mapping is ALREADY CORRECT!');
      console.log('   The issue might be elsewhere...');
    } else {
      console.log(`\n⚠️  Current mapping: DeliveryBoy.userId = ${rajuDeliveryBoy.userId}`);
      console.log(`   Should be: ${rajuUser._id}`);
      console.log('\n🔧 Updating mapping...');
      
      rajuDeliveryBoy.userId = rajuUser._id;
      await rajuDeliveryBoy.save();
      
      console.log('✅ Mapping updated successfully!');
    }

    console.log('\n─'.repeat(80));
    console.log('\n✅ VERIFICATION:\n');

    const verifyDB = await DeliveryBoy.findById(rajuDeliveryBoy._id);
    console.log(`DeliveryBoy ${verifyDB.name}:`);
    console.log(`  userId: ${verifyDB.userId}`);
    console.log(`  Should be: ${rajuUser._id}`);
    console.log(`  Match: ${verifyDB.userId.toString() === rajuUser._id.toString() ? '✅ YES' : '❌ NO'}`);

    console.log('\n📝 Next Steps:');
    console.log('1. Refresh Raju\'s dashboard (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('2. You should now see all 3 orders!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixUserMapping();
