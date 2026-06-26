const mongoose = require('mongoose');
require('dotenv').config();

const OrderSchema = new mongoose.Schema({
  orderNumber: String,
  orderStatus: String,
  deliveryBoyId: mongoose.Schema.Types.ObjectId,
  deliveryPartnerId: mongoose.Schema.Types.ObjectId,
  customer: mongoose.Schema.Types.ObjectId,
  totalAmount: Number,
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name: String,
  phone: String,
  role: String,
}, { timestamps: true });

const DeliveryBoySchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  phone: String,
  isActive: Boolean,
}, { timestamps: true });

const Order = mongoose.model('Order', OrderSchema);
const User = mongoose.model('User', UserSchema);
const DeliveryBoy = mongoose.model('DeliveryBoy', DeliveryBoySchema);

async function assignOrder() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // 1. Find the delivery partner user
    const deliveryUser = await User.findOne({ phone: '9876543210', role: 'delivery' });
    if (!deliveryUser) {
      console.log('❌ Delivery user with phone 9876543210 not found');
      await mongoose.connection.close();
      return;
    }
    console.log('✅ Found delivery user:', deliveryUser.name, '| ID:', deliveryUser._id.toString());
    
    // 2. Find the DeliveryBoy record linked to this user
    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryUser._id });
    if (!deliveryBoy) {
      console.log('❌ DeliveryBoy record not found for this user');
      await mongoose.connection.close();
      return;
    }
    console.log('✅ Found DeliveryBoy record | ID:', deliveryBoy._id.toString(), '| Active:', deliveryBoy.isActive);
    
    // 3. Find an unassigned PACKED order
    const order = await Order.findOne({
      orderStatus: 'PACKED',
      deliveryBoyId: { $exists: false }
    }).sort({ createdAt: 1 });
    
    if (!order) {
      console.log('❌ No unassigned PACKED orders available');
      await mongoose.connection.close();
      return;
    }
    console.log('✅ Found order to assign | ID:', order._id.toString(), '| Amount: ₹', order.totalAmount);
    
    // 4. Assign the order
    order.deliveryBoyId = deliveryBoy._id;
    order.deliveryPartnerId = deliveryUser._id;
    order.orderStatus = 'ASSIGNED';
    order.deliveryStatus = 'assigned';
    await order.save();
    
    console.log('\n🎉 SUCCESS! Order assigned:');
    console.log('   Order ID:', order._id.toString());
    console.log('   Status: PACKED → ASSIGNED');
    console.log('   Delivery Partner:', deliveryBoy.name, '(', deliveryUser.phone, ')');
    console.log('   Amount: ₹', order.totalAmount);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

assignOrder();
