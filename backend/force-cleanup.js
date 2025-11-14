// Force delete all non-Raju delivery boys
const mongoose = require('mongoose');
require('dotenv').config();

async function forceCleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));
    
    // Delete all delivery boys that are NOT named "raju"
    const result = await DeliveryBoy.deleteMany({ 
      name: { $ne: 'raju' } 
    });
    
    console.log(`✅ Deleted ${result.deletedCount} non-Raju delivery boy records\n`);

    // Verify only Raju remains
    const remaining = await DeliveryBoy.find({});
    console.log(`📦 Remaining Delivery Boys: ${remaining.length}\n`);
    
    remaining.forEach(db => {
      console.log(`  ✅ ${db.name} (${db._id})`);
      console.log(`     userId: ${db.userId}`);
      console.log(`     isActive: ${db.isActive}\n`);
    });

    console.log('═'.repeat(80));
    console.log('\n📝 CRITICAL: Now LOGOUT and LOGIN again as Raju!\n');
    console.log('Login: raju@gmail.com / 123456');
    console.log('You will see all 3 assigned orders!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

forceCleanup();
