const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// User model schema (simplified)
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  passwordHash: String,
  role: {
    type: String,
    enum: ["customer", "admin", "delivery"],
    default: "customer",
  },
  status: {
    type: String,
    enum: ["pending", "active", "suspended"],
    default: "active",
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', UserSchema);

async function checkUserRole() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a few users and check their roles
    const users = await User.find().limit(5).select('name email role status');
    
    console.log('\n📋 USER ROLES CHECK:');
    console.log('=====================');
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      
      // Generate a sample JWT token for this user
      const sampleToken = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" }
      );
      
      console.log(`   Sample Token Preview: ${sampleToken.substring(0, 50)}...`);
      console.log(`   Can Access Cart: ${user.role === 'customer' ? '✅ YES' : '❌ NO'}`);
      console.log('   ---');
    });

    // Check if there are any customer users
    const customerCount = await User.countDocuments({ role: 'customer' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    const deliveryCount = await User.countDocuments({ role: 'delivery' });
    
    console.log('\n📊 ROLE STATISTICS:');
    console.log('====================');
    console.log(`Customers: ${customerCount}`);
    console.log(`Admins: ${adminCount}`);
    console.log(`Delivery: ${deliveryCount}`);
    
    if (customerCount === 0) {
      console.log('\n⚠️  WARNING: No customer users found!');
      console.log('   This might be why cart access is failing.');
      console.log('   All users might have been assigned delivery or admin roles.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

checkUserRole();
