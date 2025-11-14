// Quick script to check registered users
const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://charan:987654321@csstore.2mobf49.mongodb.net/cps-store?retryWrites=true&w=majority&appName=csstore";

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('📋 REGISTERED USERS IN DATABASE');
    console.log('='.repeat(80) + '\n');

    const User = mongoose.model('User', new mongoose.Schema({
      name: String,
      email: String,
      phone: String,
      role: String,
    }));

    const users = await User.find({}, 'name email phone role').lean();

    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`✅ Found ${users.length} registered user(s):\n`);
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'N/A'}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   📱 Phone: ${user.phone}`);
        console.log(`   👤 Role: ${user.role || 'customer'}`);
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('💡 Only these emails can receive OTP for login');
    console.log('💡 Other emails need to SIGN UP first');
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
