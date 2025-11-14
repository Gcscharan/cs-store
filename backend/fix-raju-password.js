// Set password for Raju's account
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixRajuPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find Raju
    const rajuUser = await User.findOne({ email: 'raju@gmail.com' });
    
    if (!rajuUser) {
      console.log('❌ Raju not found!');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📝 Current Status:');
    console.log(`   Email: ${rajuUser.email}`);
    console.log(`   Has Password: ${rajuUser.password ? 'Yes' : 'No'}\n`);

    // Set password to "123456"
    const hashedPassword = await bcrypt.hash('123456', 10);
    rajuUser.password = hashedPassword;
    await rajuUser.save();

    console.log('✅ Password set successfully!\n');
    console.log('═'.repeat(80));
    console.log('\n🔑 RAJU\'S LOGIN CREDENTIALS:\n');
    console.log(`Email: raju@gmail.com`);
    console.log(`Password: 123456`);
    console.log('\n═'.repeat(80));
    console.log('\n📋 NEXT STEPS:\n');
    console.log('1. Go to: http://localhost:3000/delivery/login');
    console.log('2. Login with:');
    console.log('   Email: raju@gmail.com');
    console.log('   Password: 123456');
    console.log('3. You will see all 3 orders (₹955 total)!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixRajuPassword();
