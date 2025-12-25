#!/usr/bin/env node

const mongoose = require('mongoose');
const { Cart } = require('./dist/models/Cart');
const { Product } = require('./dist/models/Product');
const { User } = require('./dist/models/User');
const { ObjectId } = require('mongodb');
require('dotenv').config();

// Test configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream-store';

// Test data
let testUser, testProduct1;
const testProductId = '507f1f77bcf86cd799439011'; // Valid ObjectId

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
  
  // Create test product
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
  
  console.log('✅ Test data created');
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  try {
    await Cart.deleteOne({ userId: testUser._id });
    await Product.deleteOne({ _id: testProductId });
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
    console.log(`  Items: ${cart.items ? cart.items.length : 'null'}`);
    if (cart.items && cart.items.length > 0) {
      cart.items.forEach((item, index) => {
        console.log(`    ${index + 1}. Product: ${item.productId}, Quantity: ${item.quantity}, Price: ${item.price}`);
      });
    }
    console.log(`  Total: ${cart.total}, ItemCount: ${cart.itemCount}`);
  } else {
    console.log('  No cart found');
  }
}

// Test atomicAddToCart logic step by step
async function testAtomicAddToCart() {
  console.log('\n🧪 TEST: Atomic Add To Cart Debug');
  
  try {
    const userId = testUser._id.toString();
    const productObjectId = new ObjectId(testProductId);
    
    // Clear cart first
    await Cart.deleteOne({ userId });
    
    console.log('Step 1: Adding product first time...');
    
    // First add - should create new item
    const cart1 = await Cart.findOneAndUpdate(
      { userId },
      [
        {
          $set: {
            items: {
              $cond: {
                // Check if product already exists in items array (ObjectId comparison)
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ['$items', []] },
                          as: 'item',
                          cond: { $eq: ['$$item.productId', productObjectId] }
                        }
                      }
                    },
                    0
                  ]
                },
                then: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $cond: {
                        if: { $eq: ['$$item.productId', productObjectId] },
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
                    { $ifNull: ['$items', []] },
                    [{
                      productId: productObjectId,
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
            total: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: { $multiply: ['$$item.price', '$$item.quantity'] },
                },
              },
            },
            itemCount: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: '$$item.quantity',
                },
              },
            },
          }
        }
      ],
      { new: true, upsert: true }
    );
    
    console.log('Cart1 result:', JSON.stringify(cart1, null, 2));
    
    await logCartState('After first add');
    
    console.log('\nStep 2: Adding same product second time...');
    
    // Second add - should update existing item
    const cart2 = await Cart.findOneAndUpdate(
      { userId },
      [
        {
          $set: {
            items: {
              $cond: {
                // Check if product already exists in items array (ObjectId comparison)
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ['$items', []] },
                          as: 'item',
                          cond: { $eq: ['$$item.productId', productObjectId] }
                        }
                      }
                    },
                    0
                  ]
                },
                then: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $cond: {
                        if: { $eq: ['$$item.productId', productObjectId] },
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
                      productId: productObjectId,
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
            total: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: { $multiply: ['$$item.price', '$$item.quantity'] },
                },
              },
            },
            itemCount: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: '$$item.quantity',
                },
              },
            },
          }
        }
      ],
      { new: true, upsert: true }
    );
    
    await logCartState('After second add');
    
    // Verify results
    const finalCart = await Cart.findOne({ userId });
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
      finalCart.items.forEach((item, i) => {
        console.log(`   Item ${i+1}: Product ${item.productId}, Quantity ${item.quantity}`);
      });
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

async function runTest() {
  console.log('🚀 Starting Atomic Add To Cart Debug\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    await setupTestData();
    
    const result = await testAtomicAddToCart();
    
    console.log(`\n📊 RESULT: ${result ? 'PASSED' : 'FAILED'}`);
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    await cleanupTestData();
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  runTest();
}

module.exports = { runTest };
