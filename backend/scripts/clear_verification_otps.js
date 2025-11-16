const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const OtpSchema = new mongoose.Schema({}, { strict: false });
const Otp = mongoose.model('Otp', OtpSchema, 'otps');

(async () => {
  const phone = process.argv[2] || '9876501234';
  await mongoose.connect(mongoURI);
  const res = await Otp.deleteMany({ phone, type: 'verification' });
  console.log(`Deleted ${res.deletedCount} verification OTP(s) for ${phone}`);
  await mongoose.disconnect();
})();