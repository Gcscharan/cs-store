// Final cleanup - ensure only Raju is active and has correct userId mapping
const mongoose = require('mongoose');
require('dotenv').config();

async function finalCleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find Raju user
    const rajuUser = await User.findOne({ email: 'raju@gmail.com' });
    console.log(`✅ Raju User: ${rajuUser._id} (${rajuUser.email})`);

    // Find all delivery boys
    const allDBs = await DeliveryBoy.find({});
    console.log(`\n🔍 All Delivery Boys:\n`);

    for (const db of allDBs) {
      console.log(`${db.name} (${db._id}):`);
      console.log(`  userId: ${db.userId || 'UNDEFINED'}`);
      console.log(`  isActive: ${db.isActive}`);
      
      // If this is NOT Raju, deactivate it
      if (db.name.toLowerCase() !== 'raju') {
        console.log(`  ❌ Not Raju - DEACTIVATING`);
        db.isActive = false;
        await db.save();
      } else {
        // Ensure Raju is active and has correct userId
        console.log(`  ✅ This is Raju`);
        if (db.userId?.toString() !== rajuUser._id.toString()) {
          console.log(`  🔧 Fixing userId: ${db.userId} -> ${rajuUser._id}`);
          db.userId = rajuUser._id;
        }
        if (!db.isActive) {
          console.log(`  🔧 Activating Raju`);
          db.isActive = true;
        }
        await db.save();
      }
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('\n✅ FINAL STATE:\n');

    const activeDBs = await DeliveryBoy.find({ isActive: true });
    console.log(`Active Delivery Boys: ${activeDBs.length}\n`);
    
    for (const db of activeDBs) {
      console.log(`✅ ${db.name} (${db._id})`);
      console.log(`   userId: ${db.userId}`);
      const user = await User.findById(db.userId);
      console.log(`   User: ${user?.email || user?.phone || 'NOT FOUND'}`);
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('\n📝 NEXT STEPS:\n');
    console.log('1. LOGOUT from delivery dashboard');
    console.log('2. LOGIN with: raju@gmail.com / 123456');
    console.log('3. You will see all 3 assigned orders!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

finalCleanup();
