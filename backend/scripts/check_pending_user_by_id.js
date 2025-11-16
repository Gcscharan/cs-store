const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const PendingUserSchema = new mongoose.Schema({}, { strict: false });
const PendingUser = mongoose.model('PendingUser', PendingUserSchema, 'pendingusers');

(async () => {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node check_pending_user_by_id.js <id>'); process.exit(1); }
  await mongoose.connect(mongoURI);
  const doc = await PendingUser.findById(id);
  console.log(doc ? `FOUND: ${doc._id} phone=${doc.phone} email=${doc.email}` : 'NOT_FOUND');
  await mongoose.disconnect();
})();