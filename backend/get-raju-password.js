// Get Raju's password details
const mongoose = require('mongoose');
require('dotenv').config();

async function getRajuPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    // Find Raju
    const raju = await DeliveryBoy.findOne({ name: /raju/i });
    const rajuUser = await User.findById(raju.userId);

    console.log('🔐 RAJU LOGIN CREDENTIALS:\n');
    console.log('─'.repeat(60));
    console.log(`📱 Phone:           ${rajuUser.phone}`);
    console.log(`📧 Email:           ${rajuUser.email || 'Not set'}`);
    console.log(`👤 Name:            ${rajuUser.name}`);
    console.log(`🔑 Has Password:    ${rajuUser.password || rajuUser.passwordHash ? 'Yes' : 'No (Use OTP)'}`);
    console.log(`🔐 Password Hash:   ${rajuUser.password || rajuUser.passwordHash ? 'Set (use OTP login)' : 'Not set'}`);
    console.log(`✅ Verified:        ${rajuUser.isVerified ? 'Yes' : 'No'}`);
    console.log(`📝 Role:            ${rajuUser.role}`);
    console.log('─'.repeat(60));
    console.log('\n📝 LOGIN INSTRUCTIONS:\n');
    console.log('Since password is hashed, use OTP login:');
    console.log(`1. Go to: http://localhost:3000/delivery/login`);
    console.log(`2. Enter phone: ${rajuUser.phone}`);
    console.log(`3. Click "Send OTP"`);
    console.log(`4. Check your terminal for OTP (or SMS if configured)`);
    console.log(`5. Enter OTP and login`);
    console.log('\n✅ After login, you will see all 3 assigned orders!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

getRajuPassword();
