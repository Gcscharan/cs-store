const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const UserSchema = new mongoose.Schema({ email: String }, { strict: false });
const User = mongoose.model('User', UserSchema);

(async () => {
  const email = process.argv[2] || 'pending.user+seed@example.com';
  await mongoose.connect(mongoURI);
  const user = await User.findOne({ email });
  console.log(user ? `FOUND: ${user._id}` : 'NOT_FOUND');
  await mongoose.disconnect();
})();