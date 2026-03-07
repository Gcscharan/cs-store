import mongoose from 'mongoose';
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

describe('GST Calculation', () => {
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

    // Create test product with GST rate
    await Product.create({
      _id: mockProductId,
      name: 'Test Product',
      description: 'Test Description',
      category: 'snacks',
      price: 100, // ₹100 per item
      gstRate: 18, // 18% GST
      stock: 100,
      weight: 100,
      images: [],
      tags: [],
    });

    // Create test cart
    await Cart.create({
      userId: mockUserId,
      items: [{
        productId: mockProductId,
        name: 'Test Product',
        price: 100,
        image: 'https://example.com/test.jpg',
        quantity: 2, // 2 items × ₹100 = ₹200 subtotal
      }],
      total: 200,
      itemCount: 2,
    });
  });

  describe('calculateGst function', () => {
    it('should calculate correct GST for intra-state supply (CGST + SGST)', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();
      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      delete (globalThis as any).__testBuyerStateLower;

      expect(result.created).toBe(true);
      expect(result.order).toBeDefined();

      // Subtotal before tax: ₹200
      expect(result.order.subtotalBeforeTax).toBe(200);

      // GST at 18%: ₹36
      expect(result.order.gstAmount).toBe(36);

      // Intra-state: CGST + SGST
      expect(result.order.gstBreakdown).toBeDefined();
      expect(result.order.gstBreakdown?.type).toBe('CGST_SGST');
      expect(result.order.gstBreakdown?.cgst).toBe(18);
      expect(result.order.gstBreakdown?.sgst).toBe(18);
      expect(result.order.gstBreakdown?.totalGst).toBe(36);

      // Total tax = GST
      expect(result.order.totalTax).toBe(36);

      // Grand total = subtotal + GST + delivery (30) - discount (0)
      // = 200 + 36 + 30 = 266
      expect(result.order.grandTotal).toBe(266);
      expect(result.order.totalAmount).toBe(266);
    });

    it('should calculate correct GST for inter-state supply (IGST)', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();
      (globalThis as any).__testBuyerStateLower = 'andhra pradesh';

      // Update user address to different state
      await User.findByIdAndUpdate(mockUserId, {
        $set: {
          'addresses.$[].state': 'Andhra Pradesh',
          'addresses.$[].pincode': '521235',
        },
      });

      // Update pincode resolver mock for different state
      const { resolvePincodeDetails } = jest.requireMock('../../../../utils/pincodeResolver');
      resolvePincodeDetails.mockResolvedValueOnce({
        deliverable: true,
        state: 'Andhra Pradesh',
        postal_district: 'Krishna',
        admin_district: 'NTR',
      });

      const resolver2 = (() => {
        try {
          return jest.requireMock('../../../utils/pincodeResolver');
        } catch {
          return null;
        }
      })();
      if (resolver2?.resolvePincodeDetails?.mockResolvedValueOnce) {
        resolver2.resolvePincodeDetails.mockResolvedValueOnce({
          deliverable: true,
          state: 'Andhra Pradesh',
          postal_district: 'Krishna',
          admin_district: 'NTR',
        });
      }

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      expect(result.created).toBe(true);

      // GST at 18%: ₹36
      expect(result.order.gstAmount).toBe(36);

      // Inter-state: IGST
      expect(result.order.gstBreakdown?.type).toBe('IGST');
      expect(result.order.gstBreakdown?.igst).toBe(36);
      expect(result.order.gstBreakdown?.totalGst).toBe(36);
    });

    it('should use product-specific GST rate when available', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();
      // Update product to have different GST rate
      await Product.findByIdAndUpdate(mockProductId, {
        $set: { gstRate: 12 }, // 12% GST
      });

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      expect(result.created).toBe(true);

      // GST at 12%: ₹24
      expect(result.order.gstAmount).toBe(24);
      expect(result.order.gstBreakdown?.totalGst).toBe(24);

      // Grand total = 200 + 24 + 30 = 254
      expect(result.order.grandTotal).toBe(254);
    });

    it('should fallback to default GST rate when product has no gstRate', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();
      // Remove gstRate from product
      await Product.findByIdAndUpdate(mockProductId, {
        $unset: { gstRate: 1 },
      });

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      expect(result.created).toBe(true);

      // Default GST at 18%: ₹36
      expect(result.order.gstAmount).toBe(36);
    });

    it('should store gstRate per order item', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();
      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      expect(result.created).toBe(true);
      expect(result.order.items).toHaveLength(1);
      expect(result.order.items[0].gstRate).toBe(18);
    });

    it('should calculate GST from DB prices, not from cart', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();

      // Tamper cart item price
      await Cart.updateOne(
        { userId: mockUserId, 'items.productId': mockProductId },
        { $set: { 'items.$.price': 1 } }
      );

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      // GST should still be calculated on DB price (100 * 2 = 200, 18% => 36)
      expect(result.order.gstAmount).toBe(36);
    });

    it('should ignore any GST-related fields in cart', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();

      await Cart.updateOne(
        { userId: mockUserId, 'items.productId': mockProductId },
        { $set: { 'items.$.gstRate': 0 } as any }
      );

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      expect(result.order.gstAmount).toBe(36);
    });

    it('should round GST to 2 decimal places', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();

      await Product.findByIdAndUpdate(mockProductId, {
        $set: { price: 99.99 },
      });

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      // 2 items * 99.99 = 199.98; GST 18% = 35.9964 -> 36.00
      expect(result.order.gstAmount).toBe(36);
    });

    it('should handle multiple items with different GST rates', async () => {
      const createOrderFromCart = await getCreateOrderFromCart();

      const product2Id = new mongoose.Types.ObjectId();
      await Product.create({
        _id: product2Id,
        name: 'Test Product 2',
        description: 'Test Description',
        category: 'snacks',
        price: 50,
        gstRate: 5,
        stock: 100,
        weight: 100,
        images: [],
        tags: [],
      });

      await Cart.findOneAndUpdate(
        { userId: mockUserId },
        {
          $set: {
            items: [
              { productId: mockProductId, name: 'Test Product', price: 100, image: 'https://example.com/test.jpg', quantity: 1 },
              { productId: product2Id, name: 'Test Product 2', price: 50, image: 'https://example.com/test2.jpg', quantity: 2 },
            ],
            total: 200,
            itemCount: 3,
          },
        }
      );

      const result = await createOrderFromCart({
        userId: mockUserId,
        paymentMethod: 'cod',
      });

      expect(result.created).toBe(true);
      expect(result.order.subtotalBeforeTax).toBe(200);
      expect(result.order.gstAmount).toBe(23);
      expect(result.order.grandTotal).toBe(253);
      expect(result.order.items[0].gstRate).toBe(18);
      expect(result.order.items[1].gstRate).toBe(5);
    });
  });
});
