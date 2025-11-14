const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  role: String,
  status: String,
  passwordHash: String,
}, { collection: 'users' });

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

async function testLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'd1@gmail.com';
    const password = 'password';

    console.log('Testing login for:', email);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:', user._id);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    console.log('   Has passwordHash:', !!user.passwordHash);

    // Test password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log('   Password valid:', isValid);

    if (!isValid) {
      // Try to set a new password
      console.log('\n❌ Password invalid. Setting new password: "password123"');
      user.passwordHash = await bcrypt.hash('password123', 10);
      await user.save();
      console.log('✅ Password updated to: password123');
    }

    // Generate token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    console.log('\n📝 JWT_SECRET:', JWT_SECRET.substring(0, 20) + '...');
    
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        status: user.status,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('\n🔑 Generated Token:');
    console.log(token);
    console.log('\n📊 Token Info:');
    console.log('   Length:', token.length);
    console.log('   Parts:', token.split('.').length);
    
    // Verify it
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('\n✅ Token verified successfully');
    console.log('   Decoded:', decoded);

    console.log('\n🎯 TEST LOGIN CREDENTIALS:');
    console.log('   Email: d1@gmail.com');
    console.log('   Password:', isValid ? 'password' : 'password123');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testLogin();
