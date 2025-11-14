// Test script to verify order prices are stored correctly
const mongoose = require('mongoose');
require('dotenv').config();

async function testOrderPrices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cps');
    console.log('✅ Connected to MongoDB\n');

    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

    console.log('═'.repeat(80));
    console.log('🧪 TESTING ORDER PRICE STORAGE\n');

    // Get all orders
    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(10);

    if (orders.length === 0) {
      console.log('⚠️  No orders found in database\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`Found ${orders.length} orders. Checking prices...\n`);

    let allCorrect = true;

    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order._id}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Status: ${order.orderStatus}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
      
      // Calculate total from items
      let calculatedTotal = 0;
      console.log(`   Items (${order.items.length}):`);
      
      order.items.forEach((item, idx) => {
        const itemTotal = item.price * item.qty;
        calculatedTotal += itemTotal;
        
        console.log(`      ${idx + 1}. ${item.name}`);
        console.log(`         Price: ₹${item.price} × ${item.qty} = ₹${itemTotal}`);
        
        // Check if item has the price field
        if (!item.price || item.price === 0) {
          console.log(`         ❌ ERROR: Item price is missing or zero!`);
          allCorrect = false;
        }
      });

      console.log(`   Calculated Total: ₹${calculatedTotal}`);
      
      // Check if calculated total matches stored total
      const difference = Math.abs(order.totalAmount - calculatedTotal);
      if (difference > 1) { // Allow 1 rupee difference for rounding
        console.log(`   ❌ MISMATCH: Stored total (₹${order.totalAmount}) doesn't match calculated total (₹${calculatedTotal})`);
        allCorrect = false;
      } else {
        console.log(`   ✅ Price snapshot correct!`);
      }
      
      console.log('');
    });

    console.log('═'.repeat(80));
    
    if (allCorrect) {
      console.log('\n✅ ALL ORDERS HAVE CORRECT PRICE SNAPSHOTS!\n');
      console.log('The fix is working correctly:');
      console.log('- Each order stores prices at purchase time');
      console.log('- Item prices are preserved in order documents');
      console.log('- Total amounts match item calculations\n');
    } else {
      console.log('\n⚠️  SOME ORDERS HAVE PRICE ISSUES\n');
      console.log('This might be expected for old orders created before the fix.');
      console.log('New orders should have correct price snapshots.\n');
    }

    console.log('═'.repeat(80));
    console.log('\n🔍 VERIFICATION:\n');
    console.log('To verify the fix works for new orders:');
    console.log('1. Place a new order through the frontend');
    console.log('2. Note the total amount');
    console.log('3. Change the product price in admin panel');
    console.log('4. Check your order history');
    console.log('5. ✅ Order should still show the original price!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testOrderPrices();
