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

// Test 2: Update/remove correctness using CartService
async function testUpdateRemoveCorrectness() {
  console.log('\n🧪 TEST 2: Update & Remove Correctness (using CartService)');
  
  try {
    const cartService = new CartService();
    const userId = testUser._id.toString();
    
    // Clear cart first
    const { Cart } = require('./dist/models/Cart');
    await Cart.deleteOne({ userId });
    
    // Setup cart with 2 items
    await cartService.addToCart(userId, { productId: testProductId, quantity: 2 });
    await cartService.addToCart(userId, { productId: testProductId2, quantity: 1 });
    
    const initialResult = await cartService.getCart(userId);
    await logCartState('Initial setup', initialResult);
    
    // Test update
    const updateResult = await cartService.updateCartItem(userId, {
      productId: testProductId,
      quantity: 5
    });
    await logCartState('After updating first product quantity to 5', updateResult);
    
    // Test remove
    const removeResult = await cartService.removeFromCart(userId, {
      productId: testProductId2
    });
    await logCartState('After removing second product', removeResult);
    
    // Verify results
    if (removeResult.cart.items.length === 1 && 
        removeResult.cart.items[0].quantity === 5 &&
        removeResult.cart.items[0].productId === testProductId &&
        removeResult.cart.totalAmount === 500 && 
        removeResult.cart.itemCount === 5) {
      console.log('✅ PASSED: Update and remove operations work correctly');
      return true;
    } else {
      console.log('❌ FAILED: Update/remove operations not working as expected');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 2 error:', error);
    return false;
  }
}

// Test 3: Totals integrity using CartService
async function testTotalsIntegrity() {
  console.log('\n🧪 TEST 3: Totals Integrity (using CartService)');
  
  try {
    const cartService = new CartService();
    const userId = testUser._id.toString();
    
    // Clear cart first
    const { Cart } = require('./dist/models/Cart');
    await Cart.deleteOne({ userId });
    
    // Setup cart with items
    await cartService.addToCart(userId, { productId: testProductId, quantity: 3 });
    await cartService.addToCart(userId, { productId: testProductId2, quantity: 2 });
    
    const result = await cartService.getCart(userId);
    await logCartState('Setup for totals test', result);
    
    // Calculate expected totals
    const expectedTotal = testProduct1.price * 3 + testProduct2.price * 2; // 100*3 + 200*2 = 700
    const expectedItemCount = 3 + 2; // 5
    
    // Verify integrity
    if (result.cart.totalAmount === expectedTotal && 
        result.cart.itemCount === expectedItemCount) {
      console.log('✅ PASSED: Totals match calculations exactly');
      console.log(`   totalAmount: ${result.cart.totalAmount} === Σ(price × quantity): ${expectedTotal}`);
      console.log(`   itemCount: ${result.cart.itemCount} === Σ(quantity): ${expectedItemCount}`);
      return true;
    } else {
      console.log('❌ FAILED: Totals do not match');
      console.log(`   Expected total: ${expectedTotal}, Cart total: ${result.cart.totalAmount}`);
      console.log(`   Expected itemCount: ${expectedItemCount}, Cart itemCount: ${result.cart.itemCount}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 3 error:', error);
    return false;
  }
}

// Test 4: Concurrency safety using CartService
async function testConcurrencySafety() {
  console.log('\n🧪 TEST 4: Concurrency Safety (using CartService)');
  
  try {
    const cartService = new CartService();
    const userId = testUser._id.toString();
    
    // Clear cart first
    const { Cart } = require('./dist/models/Cart');
    await Cart.deleteOne({ userId });
    
    // Simulate concurrent operations
    const operations = [
      cartService.addToCart(userId, { productId: testProductId, quantity: 2 }),
      cartService.addToCart(userId, { productId: testProductId2, quantity: 1 })
    ];
    
    // Execute sequentially (simulating concurrent access)
    const [result1, result2] = await Promise.all(operations);
    
    const finalResult = await cartService.getCart(userId);
    await logCartState('After concurrent operations simulation', finalResult);
    
    // Final verification
    const hasDuplicates = finalResult.cart.items.some((item, index) => 
      finalResult.cart.items.findIndex(other => other.productId === item.productId) !== index
    );
    
    if (!hasDuplicates && finalResult.cart.items.length === 2) {
      console.log('✅ PASSED: Concurrent operations handled safely, no duplicates');
      return true;
    } else {
      console.log('❌ FAILED: Concurrent operations caused duplicates or data loss');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 4 error:', error);
    return false;
  }
}

// Test 5: Cleanup helper safety
async function testCleanupHelperSafety() {
  console.log('\n🧪 TEST 5: Cleanup Helper Safety');
  
  try {
    const { CartRepository } = require('./dist/domains/cart/repositories/CartRepository');
    const cartRepository = new CartRepository();
    const userId = testUser._id.toString();
    
    // Create cart with duplicates manually
    const { Cart } = require('./dist/models/Cart');
    await Cart.deleteOne({ userId });
    
    const cartWithDuplicates = new Cart({
      userId,
      items: [
        {
          productId: new mongoose.Types.ObjectId(testProductId),
          name: testProduct1.name,
          price: testProduct1.price,
          image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
          quantity: 2
        },
        {
          productId: new mongoose.Types.ObjectId(testProductId), // Same product ID
          name: testProduct1.name,
          price: testProduct1.price,
          image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
          quantity: 3
        }
      ],
      total: 500, // 100*2 + 100*3
      itemCount: 5
    });
    await cartWithDuplicates.save();
    
    const beforeCleanup = await cartRepository.findByUserIdWithPopulate(userId);
    console.log('\n📊 Before cleanup (with duplicates) - Cart State:');
    console.log(`  Items: ${beforeCleanup.items.length}`);
    beforeCleanup.items.forEach((item, index) => {
      console.log(`    ${index + 1}. Product: ${item.productId}, Quantity: ${item.quantity}, Price: ${item.price}`);
    });
    console.log(`  Total: ${cartWithDuplicates.total}, ItemCount: ${cartWithDuplicates.itemCount}`);
    
    // Test cleanup helper
    const cleanedCart = await cartRepository.cleanupDuplicateItems(userId);
    
    const afterCleanup = await cartRepository.findByUserIdWithPopulate(userId);
    console.log('\n📊 After cleanup - Cart State:');
    console.log(`  Items: ${afterCleanup.items.length}`);
    afterCleanup.items.forEach((item, index) => {
      console.log(`    ${index + 1}. Product: ${item.productId}, Quantity: ${item.quantity}, Price: ${item.price}`);
    });
    console.log(`  Total: ${cleanedCart.total}, ItemCount: ${cleanedCart.itemCount}`);
    
    // Verify cleanup worked
    if (afterCleanup.items.length === 1 && afterCleanup.items[0].quantity === 5) {
      console.log('✅ PASSED: Cleanup helper merges duplicates correctly');
      console.log('⚠️  WARNING: Cleanup helper should only be used manually by admin');
      return true;
    } else {
      console.log('❌ FAILED: Cleanup helper not working as expected');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 5 error:', error);
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
    results.push(await testUpdateRemoveCorrectness());
    results.push(await testTotalsIntegrity());
    results.push(await testConcurrencySafety());
    results.push(await testCleanupHelperSafety());
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\n📊 TEST SUMMARY: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 ALL CART INVARIANTS VERIFIED! ✅');
    } else {
      console.log('❌ SOME TESTS FAILED - Review issues above');
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
  testDuplicateProductInvariant,
  testUpdateRemoveCorrectness,
  testTotalsIntegrity,
  testConcurrencySafety,
  testCleanupHelperSafety
};
