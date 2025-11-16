// Create a PendingUser for testing verification flow
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cs-store';

const PendingUserSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  passwordHash: String,
  addresses: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
const PendingUser = mongoose.model('PendingUser', PendingUserSchema);

async function run() {
  const phone = process.argv[2] || '9876501234';
  const email = process.argv[3] || `pending.user+${Date.now()}@example.com`;

  try {
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const doc = await PendingUser.create({
      name: 'Pending Test',
      email,
      phone,
      passwordHash: '$2a$12$XKxwH3N06bM2au0V9v2eP.9YHf3SJZfZp5iJcPZQ1u6Fi9HOb3x1m', // bcrypt hash for 'Passw0rd!'
      addresses: [],
      expiresAt,
    });
    console.log('✅ Created PendingUser:', { id: doc._id.toString(), phone, email });
  } catch (err) {
    console.error('❌ Failed to create PendingUser:', err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

run();