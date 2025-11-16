const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const PendingUserSchema = new mongoose.Schema({}, { strict: false });
const PendingUser = mongoose.model('PendingUser', PendingUserSchema, 'pendingusers');

(async () => {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node delete_pending_user_by_id.js <id>'); process.exit(1); }
  await mongoose.connect(mongoURI);
  const res = await PendingUser.deleteOne({ _id: id });
  console.log(`Deleted: ${res.deletedCount}`);
  await mongoose.disconnect();
})();