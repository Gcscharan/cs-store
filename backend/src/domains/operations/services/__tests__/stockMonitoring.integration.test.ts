/**
 * Stock Monitoring Integration Tests
 * 
 * Tests the integration of stock monitoring with order placement operations.
 * Requirements: 1.2, 1.4
 */

import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Product } from '../../../../models/Product';
import { User } from '../../../../models/User';
import { Cart } from '../../../../models/Cart';
import { Order } from '../../../../models/Order';
import { Pincode } from '../../../../models/Pincode';

// Mock dependencies
jest.mock('../../../../utils/deliveryFeeCalculator', () => ({
  calculateDeliveryFee: jest.fn().mockResolvedValue({
    finalFee: 30,
    distance: 5,
    coordsSource: 'saved',
  }),
}));

jest.mock('../../../../utils/pincodeResolver', () => ({
  resolvePincodeDetails: jest.fn().mockResolvedValue({
    deliverable: true,
    state: 'Telangana',
    postal_district: 'Hyderabad',
    admin_district: 'Hyderabad',
  }),
  applyDistrictOverride: jest.fn().mockReturnValue('Hyderabad'),
}));

jest.mock('../../../events/eventBus', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../events/order.events', () => ({
  createOrderCreatedEvent: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../orders/services/inventoryReservationService', () => ({
  inventoryReservationService: {
    reserveForOrder: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock stock monitor service
jest.mock('../../../../services/stockMonitorService', () => ({
  stockMonitorService: {
    evaluateStockLevel: jest.fn().mockResolvedValue(null),
  },
}));

// Import after mocking
import { stockMonitorService } from '../../../../services/stockMonitorService';

describe('Stock Monitoring Integration with Order Placement', () => {
  let mockUserId: mongoose.Types.ObjectId;
  let mockProductId: mongoose.Types.ObjectId;

  const getCreateOrderFromCart = async () => {
    const mod = await import('../orderBuilder');
    return mod.createOrderFromCart as typeof import('../orderBuilder').createOrderFromCart;
  };

  beforeEach(async () => {
    // Clean up collections
    await Product.deleteMany({});
    await User.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Pincode.deleteMany({});

    // Clear mock calls
    jest.clearAllMocks();

    mockUserId = new mongoose.Types.ObjectId();
    mockProductId = new mongoose.Types.ObjectId();

    // Create test pincode
    await Pincode.create({
      pincode: '507115',
      state: 'Telangana',
      district: 'Hyderabad',
      deliverable: true,
    });

    // Create test user with address
    await User.create({
      _id: mockUserId,
      name: 'Test User',
      email: 'test@example.com',
      phone: '9876543210',
      password: 'hashedpassword',
      role: 'customer',
      addresses: [{
        _id: new mongoose.Types.ObjectId(),
        name: 'Test User',
        phone: '9876543210',
        label: 'HOME',
        addressLine: '123 Test Street',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_district: 'Hyderabad',
        admin_district: 'Hyderabad',
        pincode: '507115',
        lat: 17.385,
        lng: 78.4867,
        isDefault: true,
      }],
    });
  });

  describe('Stock monitoring after order placement', () => {
    it('should call evaluateStockLevel for each order item after order creation', async () => {
      // Create test product with low stock
      await Product.create({
        _id: mockProductId,
        name: 'Test Product',
        description: 'Test Description',
        category: 'snacks',
        price: 100,
        stock: 15, // Above threshold initially
        unit: 'kg',
        pricePerUnit: 100,
        gstRate: 18,
        isActive: true,
        isSellable: true,
      });

      // Create cart with item
      await Cart.create({
        userId: mockUserId,
        items: [{
          productId: mockProductId,
          name: 'Test Product',
          price: 100,
          image: 'test-image.jpg',
          quantity: 10, // This will bring stock to 5 (below threshold of 10)
        }],
        total: 1000,
        itemCount: 1,
      });

      const createOrderFromCart = await getCreateOrderFromCart();
      
      // Create order
      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
        idempotencyKey: randomUUID(),
      });

      expect(result.created).toBe(true);
      expect(result.order).toBeDefined();

      // Wait for async stock monitoring to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify evaluateStockLevel was called
      expect(stockMonitorService.evaluateStockLevel).toHaveBeenCalledWith(
        mockProductId.toString(),
        expect.any(Number)
      );
    });

    it('should call evaluateStockLevel for multiple items in order', async () => {
      const product1Id = new mongoose.Types.ObjectId();
      const product2Id = new mongoose.Types.ObjectId();

      // Create two products
      await Product.create({
        _id: product1Id,
        name: 'Product 1',
        description: 'Test Description',
        category: 'snacks',
        price: 100,
        stock: 12,
        unit: 'kg',
        pricePerUnit: 100,
        gstRate: 18,
        isActive: true,
        isSellable: true,
      });

      await Product.create({
        _id: product2Id,
        name: 'Product 2',
        description: 'Test Description',
        category: 'snacks',
        price: 150,
        stock: 8,
        unit: 'kg',
        pricePerUnit: 150,
        gstRate: 18,
        isActive: true,
        isSellable: true,
      });

      // Create cart with both items
      await Cart.create({
        userId: mockUserId,
        items: [
          { 
            productId: product1Id, 
            name: 'Product 1',
            price: 100,
            image: 'product1.jpg',
            quantity: 2 
          },
          { 
            productId: product2Id, 
            name: 'Product 2',
            price: 150,
            image: 'product2.jpg',
            quantity: 3 
          },
        ],
        total: 650,
        itemCount: 2,
      });

      const createOrderFromCart = await getCreateOrderFromCart();
      
      // Create order
      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
        idempotencyKey: randomUUID(),
      });

      expect(result.created).toBe(true);

      // Wait for async stock monitoring to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify evaluateStockLevel was called for both products
      expect(stockMonitorService.evaluateStockLevel).toHaveBeenCalledTimes(2);
      expect(stockMonitorService.evaluateStockLevel).toHaveBeenCalledWith(
        product1Id.toString(),
        expect.any(Number)
      );
      expect(stockMonitorService.evaluateStockLevel).toHaveBeenCalledWith(
        product2Id.toString(),
        expect.any(Number)
      );
    });

    it('should not block order creation if stock monitoring fails', async () => {
      // Mock evaluateStockLevel to throw error
      (stockMonitorService.evaluateStockLevel as jest.Mock).mockRejectedValueOnce(
        new Error('Stock monitoring service unavailable')
      );

      await Product.create({
        _id: mockProductId,
        name: 'Test Product',
        description: 'Test Description',
        category: 'snacks',
        price: 100,
        stock: 15,
        unit: 'kg',
        pricePerUnit: 100,
        gstRate: 18,
        isActive: true,
        isSellable: true,
      });

      await Cart.create({
        userId: mockUserId,
        items: [{
          productId: mockProductId,
          name: 'Test Product',
          price: 100,
          image: 'test-image.jpg',
          quantity: 5,
        }],
        total: 500,
        itemCount: 1,
      });

      const createOrderFromCart = await getCreateOrderFromCart();
      
      // Order creation should succeed despite stock monitoring failure
      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
        idempotencyKey: randomUUID(),
      });

      expect(result.created).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order.items).toHaveLength(1);
    });

    it('should pass updated stock level to evaluateStockLevel', async () => {
      const initialStock = 20;
      const orderQuantity = 12;
      const expectedStockAfterOrder = initialStock - orderQuantity;

      await Product.create({
        _id: mockProductId,
        name: 'Test Product',
        description: 'Test Description',
        category: 'snacks',
        price: 100,
        stock: initialStock,
        unit: 'kg',
        pricePerUnit: 100,
        gstRate: 18,
        isActive: true,
        isSellable: true,
      });

      await Cart.create({
        userId: mockUserId,
        items: [{
          productId: mockProductId,
          name: 'Test Product',
          price: 100,
          image: 'test-image.jpg',
          quantity: orderQuantity,
        }],
        total: 1200,
        itemCount: 1,
      });

      const createOrderFromCart = await getCreateOrderFromCart();
      
      await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
        idempotencyKey: randomUUID(),
      });

      // Wait for async stock monitoring to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the stock level passed is the updated level
      expect(stockMonitorService.evaluateStockLevel).toHaveBeenCalledWith(
        mockProductId.toString(),
        expectedStockAfterOrder
      );
    });
  });
});
