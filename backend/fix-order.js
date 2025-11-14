// Quick fix script to assign stuck order
const mongoose = require('mongoose');
require('dotenv').config();

async function fixOrder() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const DeliveryBoy = mongoose.model('DeliveryBoy', new mongoose.Schema({}, { strict: false }));

    // Find the stuck order
    const orderId = '690ccd22d1c26ee5622761bc';
    const order = await Order.findById(orderId);
    
    if (!order) {
      console.log('❌ Order not found');
      process.exit(1);
    }

    console.log(`📦 Found order: ${orderId}`);
    console.log(`   Current status: ${order.orderStatus}`);
    console.log(`   Delivery status: ${order.deliveryStatus}`);

    // Find an available delivery partner
    const deliveryBoy = await DeliveryBoy.findOne({ isActive: true }).sort({ currentLoad: 1 });
    
    if (!deliveryBoy) {
      console.log('❌ No delivery partners available');
      process.exit(1);
    }

    console.log(`🚴 Found delivery partner: ${deliveryBoy._id}`);

    // Update order
    order.deliveryBoyId = deliveryBoy._id;
    order.deliveryStatus = 'assigned';
    order.orderStatus = 'assigned';
    
    // Add to history
    order.history = order.history || [];
    order.history.push({
      status: 'assigned',
      deliveryStatus: 'assigned',
      updatedBy: new mongoose.Types.ObjectId(),
      updatedByRole: 'system',
      timestamp: new Date(),
      meta: { action: 'auto_fix', reason: 'Manual fix for stuck order' }
    });

    await order.save();

    // Update delivery boy
    await DeliveryBoy.findByIdAndUpdate(deliveryBoy._id, {
      $push: { assignedOrders: order._id },
      $inc: { currentLoad: 1 }
    });

    console.log('✅ Order successfully assigned!');
    console.log(`   Order status: ${order.orderStatus}`);
    console.log(`   Delivery status: ${order.deliveryStatus}`);
    console.log(`   Assigned to: ${deliveryBoy._id}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixOrder();
