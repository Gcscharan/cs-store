// Insert a test verification OTP for a given phone
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const OtpSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  type: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  isUsed: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

const Otp = mongoose.model('Otp', OtpSchema);

async function run() {
  const phone = process.argv[2] || '9876501234';
  const otp = process.argv[3] || '222333';

  try {
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const doc = await Otp.create({ phone, otp, type: 'verification', expiresAt });
    console.log('✅ Inserted test OTP:', { id: doc._id.toString(), phone, otp, type: 'verification' });
  } catch (err) {
    console.error('❌ Failed to insert test OTP:', err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

run();