const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const PendingUserSchema = new mongoose.Schema({}, { strict: false });
const PendingUser = mongoose.model('PendingUser', PendingUserSchema, 'pendingusers');

(async () => {
  const phone = process.argv[2] || '9876501234';
  await mongoose.connect(mongoURI);
  const doc = await PendingUser.findOne({ phone });
  console.log(doc ? `FOUND: ${doc._id} email=${doc.email}` : 'NOT_FOUND');
  await mongoose.disconnect();
})();