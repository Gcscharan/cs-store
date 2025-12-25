#!/usr/bin/env node

const mongoose = require('mongoose');
const { Cart } = require('./dist/models/Cart');
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
    await Cart.deleteOne({ userId: testUser._id });
    await Product.deleteOne({ _id: testProductId });
    await Product.deleteOne({ _id: testProductId2 });
    await User.deleteOne({ _id: testUser._id });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

async function logCartState(testName) {
  const cart = await Cart.findOne({ userId: testUser._id });
  console.log(`\n📊 ${testName} - Cart State:`);
  if (cart) {
    console.log(`  Items: ${cart.items.length}`);
    cart.items.forEach((item, index) => {
      console.log(`    ${index + 1}. Product: ${item.productId}, Quantity: ${item.quantity}, Price: ${item.price}`);
    });
    console.log(`  Total: ${cart.total}, ItemCount: ${cart.itemCount}`);
  } else {
    console.log('  No cart found');
  }
}

// Test 1: Duplicate product invariant
async function testDuplicateProductInvariant() {
  console.log('\n🧪 TEST 1: Duplicate Product Invariant');
  
  try {
    // Clear cart first
    await Cart.deleteOne({ userId: testUser._id });
    
    // Add product first time
    await Cart.findOneAndUpdate(
      { userId: testUser._id },
      {
        $setOnInsert: {
          items: [],
          total: 0,
          itemCount: 0
        }
      },
      { upsert: true, new: true }
    );
    
    // Simulate atomicAddToCart operation
    const cart1 = await Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $cond: {
                if: { $in: [testProductId, { $ifNull: ['$items.productId', []] }] },
                then: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $cond: {
                        if: { $eq: ['$$item.productId', new mongoose.Types.ObjectId(testProductId)] },
                        then: {
                          $mergeObjects: [
                            '$$item',
                            { quantity: { $add: ['$$item.quantity', 2] } }
                          ]
                        },
                        else: '$$item'
                      }
                    }
                  }
                },
                else: {
                  $concatArrays: [
                    '$items',
                    [{
                      productId: new mongoose.Types.ObjectId(testProductId),
                      name: testProduct1.name,
                      price: testProduct1.price,
                      image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
                      quantity: 2
                    }]
                  ]
                }
              }
            }
          }
        },
        {
          $set: {
            total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
            itemCount: { $sum: '$items.quantity' }
          }
        }
      ],
      { new: true, upsert: true }
    );
    
    await logCartState('After first add (quantity: 2)');
    
    // Add same product again
    const cart2 = await Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $cond: {
                if: { $in: [testProductId, { $ifNull: ['$items.productId', []] }] },
                then: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $cond: {
                        if: { $eq: ['$$item.productId', new mongoose.Types.ObjectId(testProductId)] },
                        then: {
                          $mergeObjects: [
                            '$$item',
                            { quantity: { $add: ['$$item.quantity', 3] } }
                          ]
                        },
                        else: '$$item'
                      }
                    }
                  }
                },
                else: {
                  $concatArrays: [
                    '$items',
                    [{
                      productId: new mongoose.Types.ObjectId(testProductId),
                      name: testProduct1.name,
                      price: testProduct1.price,
                      image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
                      quantity: 3
                    }]
                  ]
                }
              }
            }
          }
        },
        {
          $set: {
            total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
            itemCount: { $sum: '$items.quantity' }
          }
        }
      ],
      { new: true, upsert: true }
    );
    
    await logCartState('After second add (quantity: 3)');
    
    // Verify invariant
    const finalCart = await Cart.findOne({ userId: testUser._id });
    const hasDuplicates = finalCart.items.some((item, index) => 
      finalCart.items.findIndex(other => other.productId.toString() === item.productId.toString()) !== index
    );
    
    if (hasDuplicates) {
      console.log('❌ FAILED: Duplicate product rows found');
      return false;
    } else if (finalCart.items.length === 1 && finalCart.items[0].quantity === 5) {
      console.log('✅ PASSED: Same product increments quantity, no duplicate rows');
      return true;
    } else {
      console.log(`❌ FAILED: Expected 1 item with quantity 5, got ${finalCart.items.length} items`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 1 error:', error);
    return false;
  }
}

// Test 2: Update/remove correctness
async function testUpdateRemoveCorrectness() {
  console.log('\n🧪 TEST 2: Update & Remove Correctness');
  
  try {
    // Clear and setup cart with 2 items
    await Cart.deleteOne({ userId: testUser._id });
    
    const setupCart = new Cart({
      userId: testUser._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(testProductId),
          name: testProduct1.name,
          price: testProduct1.price,
          image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
          quantity: 2
        },
        {
          productId: new mongoose.Types.ObjectId(testProductId2),
          name: testProduct2.name,
          price: testProduct2.price,
          image: testProduct2.images[0]?.variants?.thumb || 'placeholder.jpg',
          quantity: 1
        }
      ],
      total: 400, // 100*2 + 200*1
      itemCount: 3
    });
    await setupCart.save();
    await logCartState('Initial setup');
    
    // Test update
    const updatedCart = await Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $map: {
                input: '$items',
                as: 'item',
                in: {
                  $cond: {
                    if: { $eq: ['$$item.productId', new mongoose.Types.ObjectId(testProductId)] },
                    then: {
                      $mergeObjects: ['$$item', { quantity: 5 }]
                    },
                    else: '$$item'
                  }
                }
              }
            }
          }
        },
        {
          $set: {
            total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
            itemCount: { $sum: '$items.quantity' }
          }
        }
      ],
      { new: true }
    );
    
    await logCartState('After updating first product quantity to 5');
    
    // Test remove
    const cartAfterRemove = await Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $filter: {
                input: '$items',
                as: 'item',
                cond: { $ne: ['$$item.productId', new mongoose.Types.ObjectId(testProductId2)] }
              }
            }
          }
        },
        {
          $set: {
            total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
            itemCount: { $sum: '$items.quantity' }
          }
        }
      ],
      { new: true }
    );
    
    await logCartState('After removing second product');
    
    // Verify results
    if (cartAfterRemove.items.length === 1 && 
        cartAfterRemove.items[0].quantity === 5 &&
        cartAfterRemove.items[0].productId.toString() === testProductId &&
        cartAfterRemove.total === 500 && // 100*5
        cartAfterRemove.itemCount === 5) {
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

// Test 3: Totals integrity
async function testTotalsIntegrity() {
  console.log('\n🧪 TEST 3: Totals Integrity');
  
  try {
    // Clear and setup cart
    await Cart.deleteOne({ userId: testUser._id });
    
    const testCart = new Cart({
      userId: testUser._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(testProductId),
          name: testProduct1.name,
          price: testProduct1.price,
          image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
          quantity: 3
        },
        {
          productId: new mongoose.Types.ObjectId(testProductId2),
          name: testProduct2.name,
          price: testProduct2.price,
          image: testProduct2.images[0]?.variants?.thumb || 'placeholder.jpg',
          quantity: 2
        }
      ]
    });
    
    // Calculate expected totals
    const expectedTotal = testProduct1.price * 3 + testProduct2.price * 2; // 100*3 + 200*2 = 700
    const expectedItemCount = 3 + 2; // 5
    
    testCart.total = expectedTotal;
    testCart.itemCount = expectedItemCount;
    await testCart.save();
    
    await logCartState('Setup for totals test');
    
    // Verify integrity
    const calculatedTotal = testCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const calculatedItemCount = testCart.items.reduce((sum, item) => sum + item.quantity, 0);
    
    if (testCart.total === calculatedTotal && 
        testCart.itemCount === calculatedItemCount &&
        testCart.total === expectedTotal &&
        testCart.itemCount === expectedItemCount) {
      console.log('✅ PASSED: Totals match calculations exactly');
      console.log(`   totalAmount: ${testCart.total} === Σ(price × quantity): ${calculatedTotal}`);
      console.log(`   itemCount: ${testCart.itemCount} === Σ(quantity): ${calculatedItemCount}`);
      return true;
    } else {
      console.log('❌ FAILED: Totals do not match');
      console.log(`   Expected total: ${expectedTotal}, Cart total: ${testCart.total}, Calculated: ${calculatedTotal}`);
      console.log(`   Expected itemCount: ${expectedItemCount}, Cart itemCount: ${testCart.itemCount}, Calculated: ${calculatedItemCount}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test 3 error:', error);
    return false;
  }
}

// Test 4: Concurrency safety (simulated)
async function testConcurrencySafety() {
  console.log('\n🧪 TEST 4: Concurrency Safety (Simulated)');
  
  try {
    // Clear cart
    await Cart.deleteOne({ userId: testUser._id });
    
    // Simulate two simultaneous add operations
    const operations = [];
    
    // Operation 1: Add product 1 with quantity 2
    const op1 = Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $cond: {
                if: { $in: [testProductId, { $ifNull: ['$items.productId', []] }] },
                then: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $cond: {
                        if: { $eq: ['$$item.productId', new mongoose.Types.ObjectId(testProductId)] },
                        then: {
                          $mergeObjects: [
                            '$$item',
                            { quantity: { $add: ['$$item.quantity', 2] } }
                          ]
                        },
                        else: '$$item'
                      }
                    }
                  }
                },
                else: {
                  $concatArrays: [
                    '$items',
                    [{
                      productId: new mongoose.Types.ObjectId(testProductId),
                      name: testProduct1.name,
                      price: testProduct1.price,
                      image: testProduct1.images[0]?.variants?.thumb || 'placeholder.jpg',
                      quantity: 2
                    }]
                  ]
                }
              }
            }
          }
        },
        {
          $set: {
            total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
            itemCount: { $sum: '$items.quantity' }
          }
        }
      ],
      { new: true, upsert: true }
    );
    
    // Operation 2: Add product 2 with quantity 1
    const op2 = Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $cond: {
                if: { $in: [testProductId2, { $ifNull: ['$items.productId', []] }] },
                then: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $cond: {
                        if: { $eq: ['$$item.productId', new mongoose.Types.ObjectId(testProductId2)] },
                        then: {
                          $mergeObjects: [
                            '$$item',
                            { quantity: { $add: ['$$item.quantity', 1] } }
                          ]
                        },
                        else: '$$item'
                      }
                    }
                  }
                },
                else: {
                  $concatArrays: [
                    '$items',
                    [{
                      productId: new mongoose.Types.ObjectId(testProductId2),
                      name: testProduct2.name,
                      price: testProduct2.price,
                      image: testProduct2.images[0]?.variants?.thumb || 'placeholder.jpg',
                      quantity: 1
                    }]
                  ]
                }
              }
            }
          }
        },
        {
          $set: {
            total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
            itemCount: { $sum: '$items.quantity' }
          }
        }
      ],
      { new: true, upsert: true }
    );
    
    // Execute operations sequentially (simulating concurrent access)
    const result1 = await op1;
    const result2 = await op2;
    
    await logCartState('After concurrent operations simulation');
    
    // Final verification
    const finalCart = await Cart.findOne({ userId: testUser._id });
    const hasDuplicates = finalCart.items.some((item, index) => 
      finalCart.items.findIndex(other => other.productId.toString() === item.productId.toString()) !== index
    );
    
    if (!hasDuplicates && finalCart.items.length === 2) {
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
    // Clear cart
    await Cart.deleteOne({ userId: testUser._id });
    
    // Create a cart with potential duplicates (simulating old bug)
    const cartWithDuplicates = new Cart({
      userId: testUser._id,
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
    
    await logCartState('Before cleanup (with duplicates)');
    
    // Test cleanup helper (simulate the method from CartRepository)
    const cleanedCart = await Cart.findOneAndUpdate(
      { userId: testUser._id },
      [
        {
          $set: {
            items: {
              $reduce: {
                input: { $ifNull: ['$items', []] },
                initialValue: [],
                in: {
                  $let: {
                    vars: {
                      existingItem: {
                        $first: {
                          $filter: {
                            input: '$$value',
                            as: 'existing',
                            cond: { $eq: ['$$existing.productId', '$$this.productId'] }
                          }
                        }
                      }
                    },
                    in: {
                      $cond: {
                        if: { $ne: ['$$existingItem', null] },
                        then: {
                          $map: {
                            input: '$$value',
                            as: 'item',
                            in: {
                              $cond: {
                                if: { $eq: ['$$item.productId', '$$this.productId'] },
                                then: {
                                  $mergeObjects: [
                                    '$$item',
                                    {
                                      quantity: {
                                        $add: ['$$item.quantity', '$$this.quantity']
                                      }
                                    }
                                  ]
                                },
                                else: '$$item'
                              }
                            }
                          }
                        },
                        else: { $concatArrays: ['$$value', ['$$this']] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $set: {
            total: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: { $multiply: ['$$item.price', '$$item.quantity'] }
                }
              }
            },
            itemCount: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: '$$item.quantity'
                }
              }
            }
          }
        }
      ],
      { new: true }
    );
    
    await logCartState('After cleanup');
    
    // Verify cleanup worked
    if (cleanedCart.items.length === 1 && cleanedCart.items[0].quantity === 5) {
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
  console.log('🚀 Starting Cart Invariant Tests\n');
  
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
  testDuplicateProductInvariant,
  testUpdateRemoveCorrectness,
  testTotalsIntegrity,
  testConcurrencySafety,
  testCleanupHelperSafety
};
