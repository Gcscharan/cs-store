#!/usr/bin/env node

const mongoose = require('mongoose');
const { CartService } = require('./dist/domains/cart/services/CartService');
const { Product } = require('./dist/models/Product');
const { User } = require('./dist/models/User');
require('dotenv').config();

// Test configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream-store';

// Test data
let testUser, testProduct1, testProduct2;
const testProductId = '507f1f77bcf86cd799439011'; // Valid ObjectId
const testProductId2 = '507f1f77bcf86cd799439012'; // Valid ObjectId

async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  // Create test user
  testUser = new User({
    email: 'carttest@example.com',
    password: 'test123',
    role: 'customer',
    name: 'Cart Test User'
  });
  await testUser.save();
  
  // Create test products
  testProduct1 = new Product({
    _id: testProductId,
    name: 'Test Product 1',
    price: 100,
    stock: 10,
    images: [{
      variants: {
        thumb: 'test1-thumb.jpg',
        small: 'test1-small.jpg'
      }
    }],
    category: 'snacks',
    description: 'Test product 1',
    weight: 100
  });
  await testProduct1.save();
  
  testProduct2 = new Product({
    _id: testProductId2,
    name: 'Test Product 2',
    price: 200,
    stock: 5,
    images: [{
      variants: {
        thumb: 'test2-thumb.jpg',
        small: 'test2-small.jpg'
      }
    }],
    category: 'beverages',
    description: 'Test product 2',
    weight: 200
  });
  await testProduct2.save();
  
  console.log('✅ Test data created');
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  try {
    const { Cart } = require('./dist/models/Cart');
    await Cart.deleteOne({ userId: testUser._id });
    await Product.deleteOne({ _id: testProductId });
    await Product.deleteOne({ _id: testProductId2 });
    await User.deleteOne({ _id: testUser._id });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

async function logCartState(testName, cartResult) {
  console.log(`\n📊 ${testName} - Cart State:`);
  if (cartResult && cartResult.cart) {
    console.log(`  Items: ${cartResult.cart.items.length}`);
    cartResult.cart.items.forEach((item, index) => {
      console.log(`    ${index + 1}. Product: ${item.productId}, Quantity: ${item.quantity}, Price: ${item.price}`);
    });
    console.log(`  Total: ${cartResult.cart.totalAmount}, ItemCount: ${cartResult.cart.itemCount}`);
  } else {
    console.log('  No cart found');
  }
}

// Test 1: Duplicate product invariant using CartService
async function testDuplicateProductInvariant() {
  console.log('\n🧪 TEST 1: Duplicate Product Invariant (using CartService)');
  
  try {
    const cartService = new CartService();
    const userId = testUser._id.toString();
    
    // Add product first time
    const result1 = await cartService.addToCart(userId, {
      productId: testProductId,
      quantity: 2
    });
    await logCartState('After first add (quantity: 2)', result1);
    
    // Add same product again
    const result2 = await cartService.addToCart(userId, {
      productId: testProductId,
      quantity: 3
    });
    await logCartState('After second add (quantity: 3)', result2);
    
    // Verify invariant
    if (result2.cart.items.length === 1 && 
        result2.cart.items[0].quantity === 5 &&
        result2.cart.items[0].productId === testProductId) {
      console.log('✅ PASSED: Same product increments quantity, no duplicate rows');
      return true;
    } else {
      console.log('❌ FAILED: Expected 1 item with quantity 5');
      console.log(`   Got ${result2.cart.items.length} items`);
      result2.cart.items.forEach((item, i) => {
        console.log(`   Item ${i+1}: Product ${item.productId}, Quantity ${item.quantity}`);
      });
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 1 error:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Cart Service Tests\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    await setupTestData();
    
    const results = [];
    results.push(await testDuplicateProductInvariant());
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\n📊 TEST SUMMARY: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 ALL CART INVARIANTS VERIFIED! ✅');
    } else {
      console.log('❌ SOME TESTS FAILED - Review the issues above');
    }
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    await cleanupTestData();
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testDuplicateProductInvariant
};
