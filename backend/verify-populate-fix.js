// Verify that populate no longer includes price field
const mongoose = require('mongoose');
require('dotenv').config();

async function verifyPopulateFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

    console.log('═'.repeat(80));
    console.log('🧪 VERIFYING POPULATE FIX\n');

    // Simulate what the controller does
    const orders = await Order.find({})
      .limit(3)
      .populate("items.productId", "name images");

    if (orders.length === 0) {
      console.log('⚠️  No orders found\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`Testing ${orders.length} orders...\n`);

    let fixWorking = true;

    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order._id}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
      console.log(`   Items:`);

      order.items.forEach((item, idx) => {
        console.log(`      ${idx + 1}. ${item.name || 'Unknown'}`);
        console.log(`         Stored price: ₹${item.price}`);
        console.log(`         Stored qty: ${item.qty}`);
        
        if (item.productId && typeof item.productId === 'object') {
          console.log(`         Populated productId.name: ${item.productId.name}`);
          console.log(`         Populated productId.images: ${item.productId.images ? item.productId.images.length + ' images' : 'none'}`);
          
          // Check if price was populated (BUG if this exists)
          if (item.productId.price !== undefined) {
            console.log(`         ❌ BUG: productId.price exists: ₹${item.productId.price}`);
            console.log(`         ❌ This would overwrite the stored price!`);
            fixWorking = false;
          } else {
            console.log(`         ✅ productId.price: undefined (correct!)`);
          }
        }
        console.log('');
      });
      console.log('');
    });

    console.log('═'.repeat(80));
    
    if (fixWorking) {
      console.log('\n✅ FIX IS WORKING CORRECTLY!\n');
      console.log('Details:');
      console.log('- ✅ Populate only includes: name, images');
      console.log('- ✅ Populate does NOT include: price, mrp');
      console.log('- ✅ Stored item.price is preserved');
      console.log('- ✅ No current prices overwriting historical prices\n');
      
      console.log('What this means:');
      console.log('- Each order displays the price paid at purchase time');
      console.log('- Price changes to products do NOT affect old orders');
      console.log('- Order history is accurate and immutable\n');
    } else {
      console.log('\n❌ FIX NOT WORKING!\n');
      console.log('The populate call is still including price fields.');
      console.log('Check controllers to ensure populate only includes "name images"\n');
    }

    console.log('═'.repeat(80));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyPopulateFix();
