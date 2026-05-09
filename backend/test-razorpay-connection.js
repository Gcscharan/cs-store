/**
 * Razorpay Connection Test
 * 
 * This script tests if Razorpay credentials are valid and can create orders
 */

require('dotenv').config();
const Razorpay = require('razorpay');

async function testRazorpayConnection() {
  console.log('🧪 Testing Razorpay Connection\n');
  
  // Check credentials
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  console.log('📋 Credentials Check:');
  console.log('  - RAZORPAY_KEY_ID:', keyId ? `${keyId.substring(0, 15)}...` : '❌ MISSING');
  console.log('  - RAZORPAY_KEY_SECRET:', keySecret ? `${keySecret.substring(0, 8)}...` : '❌ MISSING');
  console.log('  - Mode:', keyId?.startsWith('rzp_live_') ? '🔴 LIVE/PRODUCTION' : '🟢 TEST');
  console.log('');
  
  if (!keyId || !keySecret) {
    console.error('❌ Missing Razorpay credentials!');
    console.log('\nTo fix:');
    console.log('1. Get credentials from https://dashboard.razorpay.com/app/keys');
    console.log('2. Add to backend/.env:');
    console.log('   RAZORPAY_KEY_ID=rzp_test_...');
    console.log('   RAZORPAY_KEY_SECRET=...');
    return;
  }
  
  // Initialize client
  console.log('🔌 Initializing Razorpay client...');
  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
  console.log('✅ Client initialized\n');
  
  // Test order creation
  console.log('💳 Testing order creation...');
  try {
    const testOrder = await razorpay.orders.create({
      amount: 5000, // ₹50.00 in paise
      currency: 'INR',
      receipt: `test_${Date.now()}`,
      notes: {
        test: 'true',
        purpose: 'connection_test',
      },
    });
    
    console.log('✅ Order created successfully!');
    console.log('  - Order ID:', testOrder.id);
    console.log('  - Amount:', testOrder.amount / 100, 'INR');
    console.log('  - Status:', testOrder.status);
    console.log('  - Created:', new Date(testOrder.created_at * 1000).toISOString());
    console.log('');
    console.log('🎉 Razorpay connection is working!');
    console.log('');
    
    if (keyId.startsWith('rzp_live_')) {
      console.log('⚠️  WARNING: You are using LIVE credentials!');
      console.log('   - Real money will be charged');
      console.log('   - Use TEST credentials for development');
      console.log('   - Get test keys from: https://dashboard.razorpay.com/app/keys');
    }
    
  } catch (error) {
    console.error('❌ Order creation failed!');
    console.error('');
    console.error('Error details:');
    console.error('  - Message:', error.message);
    console.error('  - Status Code:', error.statusCode);
    console.error('  - Error:', error.error);
    console.error('');
    
    if (error.statusCode === 401 || error.statusCode === 403) {
      console.log('🔍 Diagnosis: Authentication failed');
      console.log('');
      console.log('Possible causes:');
      console.log('  1. Invalid credentials');
      console.log('  2. Credentials expired');
      console.log('  3. Account not activated');
      console.log('');
      console.log('To fix:');
      console.log('  1. Go to https://dashboard.razorpay.com/app/keys');
      console.log('  2. Regenerate API keys');
      console.log('  3. Update backend/.env with new keys');
    } else if (error.statusCode === 400) {
      console.log('🔍 Diagnosis: Invalid request');
      console.log('');
      console.log('Possible causes:');
      console.log('  1. Account not activated for live payments');
      console.log('  2. KYC not completed');
      console.log('  3. Payment methods not enabled');
      console.log('');
      console.log('To fix:');
      console.log('  1. Complete KYC at https://dashboard.razorpay.com/');
      console.log('  2. Or use TEST credentials for development');
    } else {
      console.log('🔍 Diagnosis: API error');
      console.log('');
      console.log('Possible causes:');
      console.log('  1. Network issue');
      console.log('  2. Razorpay API is down');
      console.log('  3. Rate limiting');
      console.log('');
      console.log('To fix:');
      console.log('  1. Check internet connection');
      console.log('  2. Check Razorpay status: https://status.razorpay.com/');
      console.log('  3. Try again in a few minutes');
    }
  }
}

testRazorpayConnection().catch(console.error);
