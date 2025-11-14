const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({}, { collection: 'users', strict: false });
const deliveryBoySchema = new mongoose.Schema({}, { collection: 'deliveryboys', strict: false });

const User = mongoose.model('User', userSchema);
const DeliveryBoy = mongoose.model('DeliveryBoy', deliveryBoySchema);

async function getAllDeliveryCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('              ALL DELIVERY BOY LOGIN CREDENTIALS');
    console.log('='.repeat(80));
    console.log('');

    // Find all users with delivery role
    const deliveryUsers = await User.find({ role: 'delivery' });

    for (const user of deliveryUsers) {
      const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
      
      console.log(`👤 ${user.name.toUpperCase()}`);
      console.log('─'.repeat(80));
      console.log(`   📧 Email:          ${user.email}`);
      console.log(`   📱 Phone:          ${user.phone}`);
      console.log(`   🔑 Password:       Try these passwords in order:`);
      
      // Test common passwords
      const passwordsToTest = ['password', 'password123', '123456', user.name.toLowerCase()];
      let foundPassword = null;
      
      if (user.passwordHash) {
        for (const pwd of passwordsToTest) {
          const isValid = await bcrypt.compare(pwd, user.passwordHash);
          if (isValid) {
            foundPassword = pwd;
            break;
          }
        }
      }
      
      if (foundPassword) {
        console.log(`   ✅ WORKING PASSWORD: "${foundPassword}"`);
      } else {
        console.log(`   ❌ No common password found. Setting to: "delivery123"`);
        user.passwordHash = await bcrypt.hash('delivery123', 10);
        await user.save();
        console.log(`   ✅ Password updated to: "delivery123"`);
        foundPassword = 'delivery123';
      }
      
      console.log(`   👤 User ID:        ${user._id}`);
      console.log(`   ✅ Status:         ${user.status}`);
      
      if (deliveryBoy) {
        console.log(`   🚴 Delivery ID:    ${deliveryBoy._id}`);
        console.log(`   🏍️  Vehicle:        ${deliveryBoy.vehicleType || 'N/A'}`);
        console.log(`   📍 Available:      ${deliveryBoy.availability || 'offline'}`);
      }
      
      console.log('');
      console.log(`   🔐 LOGIN URL: http://localhost:3000/delivery/login`);
      console.log(`   📝 Email: ${user.email}`);
      console.log(`   🔑 Pass:  ${foundPassword}`);
      console.log('');
    }

    console.log('='.repeat(80));

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

getAllDeliveryCredentials();
