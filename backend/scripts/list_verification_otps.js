const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const OtpSchema = new mongoose.Schema({}, { strict: false });
const Otp = mongoose.model('Otp', OtpSchema, 'otps');

(async () => {
  const phone = process.argv[2] || '9876501234';
  await mongoose.connect(mongoURI);
  const docs = await Otp.find({ phone, type: 'verification' }).sort({ createdAt: -1 }).lean();
  console.log(docs.map(d => ({ id: d._id, otp: d.otp, isUsed: d.isUsed, expiresAt: d.expiresAt, createdAt: d.createdAt })));
  await mongoose.disconnect();
})();