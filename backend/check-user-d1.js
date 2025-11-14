const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  role: String,
  status: String,
  passwordHash: String,
  deliveryProfile: Object,
}, { collection: 'users' });

const deliveryBoySchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  userId: mongoose.Schema.Types.ObjectId,
  vehicleType: String,
  isActive: Boolean,
  availability: String,
}, { collection: 'deliveryboys' });

const User = mongoose.model('User', userSchema);
const DeliveryBoy = mongoose.model('DeliveryBoy', deliveryBoySchema);

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps-store');
    console.log('Connected to MongoDB');

    const userId = '69101d19abe6da7ba5864233';
    
    console.log('\n=== Checking User ===');
    const user = await User.findById(userId);
    if (user) {
      console.log('✅ User found:', {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      });
    } else {
      console.log('❌ User NOT found with ID:', userId);
    }

    console.log('\n=== Checking DeliveryBoy ===');
    const deliveryBoy = await DeliveryBoy.findOne({ userId: userId });
    if (deliveryBoy) {
      console.log('✅ DeliveryBoy found:', {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        email: deliveryBoy.email,
        phone: deliveryBoy.phone,
        userId: deliveryBoy.userId,
        vehicleType: deliveryBoy.vehicleType,
        isActive: deliveryBoy.isActive,
      });
    } else {
      console.log('❌ DeliveryBoy NOT found for userId:', userId);
    }

    console.log('\n=== All Delivery Users ===');
    const allDeliveryUsers = await User.find({ role: 'delivery' });
    console.log(`Found ${allDeliveryUsers.length} delivery users:`);
    allDeliveryUsers.forEach(u => {
      console.log(`  - ${u.name} (${u.email}) - Status: ${u.status} - ID: ${u._id}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkUser();
