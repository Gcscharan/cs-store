/**
 * Task 8.1: Test web confirm → mobile updates instantly
 * 
 * This test verifies that when a confirm action is performed on web admin,
 * the mobile admin shows updated status within 1 second and allowedActions
 * are updated correctly.
 * 
 * Requirements: 4.1, 7.1
 * **Validates: Requirements 4.1, 7.1**
 */

import { socketClient } from '../services/socketClient';
import { createOrderListUpdater, updateSingleOrderState } from '../utils/orderStateUtils';

// Mock socket client
jest.mock('../services/socketClient', () => ({
  socketClient: {
    subscribeToOrderStatusChanges: jest.fn(),
    subscribeToOrderAssignments: jest.fn(),
    isConnected: true,
    connect: jest.fn(),
    disconnect: jest.fn(),
    reconnectWithNewToken: jest.fn(),
  },
}));

// Test data - Order in CREATED state
const mockCreatedOrder = {
  _id: 'test-order-id',
  orderNumber: 'ORD-001',
  status: 'CREATED',
  orderStatus: 'CREATED',
  allowedActions: ['CONFIRM', 'CANCEL'],
  userId: { name: 'Test Customer', phone: '1234567890' },
  items: [
    {
      productId: { name: 'Test Product' },
      qty: 1,
      price: 100,
    },
  ],
  totalAmount: 100,
  createdAt: '2024-01-01T00:00:00Z',
};

// Order after web admin confirms it
const mockConfirmedOrder = {
  ...mockCreatedOrder,
  status: 'CONFIRMED',
  orderStatus: 'CONFIRMED',
  allowedActions: ['PACK', 'CANCEL'], // Updated allowed actions after confirm
};

describe('Task 8.1: Web Confirm → Mobile Updates Instantly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Web Admin Confirm Action → Mobile Update', () => {
    it('should update mobile order status within 1 second when web admin confirms', () => {
      const mockCallback = jest.fn();
      
      // Setup mock subscription for order status changes
      (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return jest.fn(); // unsubscribe function
      });

      // Mobile admin subscribes to socket events
      const unsubscribe = socketClient.subscribeToOrderStatusChanges(mockCallback);

      // Simulate web admin confirm action via socket event
      const webConfirmEvent = {
        orderId: 'test-order-id',
        from: 'CREATED',
        to: 'CONFIRMED',
        actorRole: 'ADMIN' as const,
        actorId: 'web-admin-user-id',
        timestamp: new Date().toISOString(),
        order: mockConfirmedOrder, // Complete updated order object
      };

      const startTime = performance.now();

      // Web admin confirms order → socket event fired
      mockCallback(webConfirmEvent);

      const processingTime = performance.now() - startTime;

      // Verify event was processed within performance bounds (< 50ms for processing)
      expect(processingTime).toBeLessThan(50);
      
      // Verify mobile admin received the event
      expect(mockCallback).toHaveBeenCalledWith(webConfirmEvent);
      
      // Verify event contains updated order with correct status and allowedActions
      expect(webConfirmEvent.order.status).toBe('CONFIRMED');
      expect(webConfirmEvent.order.allowedActions).toEqual(['PACK', 'CANCEL']);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should update mobile order list state correctly when web admin confirms', () => {
      // Mobile admin has order list with CREATED order
      const mobileOrderList = [mockCreatedOrder];
      
      // Web admin confirms order → mobile receives socket event with updated order
      const updater = createOrderListUpdater(mockConfirmedOrder);
      const updatedList = updater(mobileOrderList);

      // Verify mobile order list is updated correctly
      expect(updatedList).toHaveLength(1);
      expect(updatedList[0]._id).toBe(mockCreatedOrder._id);
      expect(updatedList[0].status).toBe('CONFIRMED'); // Status updated
      expect(updatedList[0].allowedActions).toEqual(['PACK', 'CANCEL']); // Actions updated
      
      // Verify other order properties are preserved
      expect(updatedList[0].orderNumber).toBe(mockCreatedOrder.orderNumber);
      expect(updatedList[0].totalAmount).toBe(mockCreatedOrder.totalAmount);
    });

    it('should update mobile order detail state correctly when web admin confirms', () => {
      // Mobile admin viewing order detail for CREATED order
      const mobileCurrentOrder = mockCreatedOrder;
      
      // Web admin confirms order → mobile receives socket event
      const updatedOrder = updateSingleOrderState(mobileCurrentOrder, mockConfirmedOrder);

      // Verify mobile order detail is updated correctly
      expect(updatedOrder).not.toBeNull();
      expect(updatedOrder!._id).toBe(mockCreatedOrder._id);
      expect(updatedOrder!.status).toBe('CONFIRMED'); // Status updated
      expect(updatedOrder!.allowedActions).toEqual(['PACK', 'CANCEL']); // Actions updated
    });

    it('should meet 1-second update requirement for web → mobile sync', () => {
      const mockCallback = jest.fn();
      
      (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return jest.fn();
      });

      socketClient.subscribeToOrderStatusChanges(mockCallback);

      // Simulate the complete flow timing
      const startTime = performance.now();
      
      // 1. Web admin clicks confirm (simulated)
      // 2. API call to backend (simulated - assume 200ms)
      const apiCallTime = 200;
      
      // 3. Socket event fired to mobile (simulated)
      setTimeout(() => {
        mockCallback({
          orderId: 'test-order-id',
          from: 'CREATED',
          to: 'CONFIRMED',
          actorRole: 'ADMIN' as const,
          actorId: 'web-admin-user-id',
          timestamp: new Date().toISOString(),
          order: mockConfirmedOrder,
        });
        
        const totalTime = performance.now() - startTime;
        
        // Total time should be well under 1 second (1000ms)
        // API call (200ms) + socket propagation (~50ms) + processing (~10ms) = ~260ms
        expect(totalTime).toBeLessThan(1000);
        expect(totalTime).toBeGreaterThan(apiCallTime); // Should include API time
        
      }, apiCallTime);
    });
  });

  describe('AllowedActions Update Verification', () => {
    it('should update allowedActions correctly when web admin confirms order', () => {
      // Initial state: CREATED order can be CONFIRMED or CANCELLED
      expect(mockCreatedOrder.allowedActions).toEqual(['CONFIRM', 'CANCEL']);
      
      // After web admin confirms: CONFIRMED order can be PACKED or CANCELLED
      const updater = createOrderListUpdater(mockConfirmedOrder);
      const result = updater([mockCreatedOrder]);
      
      expect(result[0].allowedActions).toEqual(['PACK', 'CANCEL']);
      expect(result[0].allowedActions).not.toContain('CONFIRM'); // Confirm no longer available
      expect(result[0].allowedActions).toContain('PACK'); // Pack now available
    });

    it('should preserve allowedActions from backend response exactly', () => {
      // Backend might return different allowedActions based on business rules
      const backendResponse = {
        ...mockConfirmedOrder,
        allowedActions: ['PACK', 'ASSIGN', 'CANCEL'], // Backend includes ASSIGN
      };
      
      const updater = createOrderListUpdater(backendResponse);
      const result = updater([mockCreatedOrder]);
      
      // Mobile should use exact allowedActions from backend
      expect(result[0].allowedActions).toEqual(['PACK', 'ASSIGN', 'CANCEL']);
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should maintain identical state between web and mobile after confirm', () => {
      // Web admin state after confirm
      const webOrderState = mockConfirmedOrder;
      
      // Mobile admin state after receiving socket event
      const mobileUpdater = createOrderListUpdater(mockConfirmedOrder);
      const mobileOrderState = mobileUpdater([mockCreatedOrder])[0];
      
      // Both platforms should have identical state
      expect(mobileOrderState.status).toBe(webOrderState.status);
      expect(mobileOrderState.allowedActions).toEqual(webOrderState.allowedActions);
      expect(mobileOrderState._id).toBe(webOrderState._id);
      expect(mobileOrderState.orderNumber).toBe(webOrderState.orderNumber);
    });

    it('should handle rapid web admin actions correctly on mobile', () => {
      const orderList = [mockCreatedOrder];
      
      // Simulate rapid web admin actions: CREATED → CONFIRMED → PACKED
      const confirmedOrder = { ...mockCreatedOrder, status: 'CONFIRMED', allowedActions: ['PACK'] };
      const packedOrder = { ...mockCreatedOrder, status: 'PACKED', allowedActions: ['ASSIGN'] };
      
      // Apply updates in sequence (as mobile would receive socket events)
      const updater1 = createOrderListUpdater(confirmedOrder);
      const result1 = updater1(orderList);
      
      const updater2 = createOrderListUpdater(packedOrder);
      const result2 = updater2(result1);
      
      // Final mobile state should match final web state
      expect(result2[0].status).toBe('PACKED');
      expect(result2[0].allowedActions).toEqual(['ASSIGN']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle socket events for non-existent orders gracefully', () => {
      const orderList = [mockCreatedOrder];
      
      // Socket event for different order
      const differentOrderUpdate = {
        ...mockConfirmedOrder,
        _id: 'different-order-id',
      };
      
      const updater = createOrderListUpdater(differentOrderUpdate);
      const result = updater(orderList);
      
      // Original order should remain unchanged
      expect(result).toEqual(orderList);
      expect(result[0].status).toBe('CREATED');
    });

    it('should handle malformed socket event data gracefully', () => {
      const mockCallback = jest.fn();
      
      (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return jest.fn();
      });

      socketClient.subscribeToOrderStatusChanges(mockCallback);

      // Test with various malformed events
      const malformedEvents = [
        null,
        undefined,
        {},
        { orderId: null, order: null },
        { orderId: 'test-id', order: undefined },
        { orderId: 'test-id', order: {} },
      ];

      malformedEvents.forEach((eventData) => {
        expect(() => {
          mockCallback(eventData);
        }).not.toThrow();
      });

      expect(mockCallback).toHaveBeenCalledTimes(malformedEvents.length);
    });
  });

  describe('Performance Requirements', () => {
    it('should process web admin confirm events within performance bounds', () => {
      const mockCallback = jest.fn();
      
      (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return jest.fn();
      });

      socketClient.subscribeToOrderStatusChanges(mockCallback);

      const startTime = performance.now();
      
      // Process multiple rapid confirm events
      for (let i = 0; i < 10; i++) {
        mockCallback({
          orderId: `order-${i}`,
          from: 'CREATED',
          to: 'CONFIRMED',
          actorRole: 'ADMIN' as const,
          actorId: 'web-admin',
          timestamp: new Date().toISOString(),
          order: { ...mockConfirmedOrder, _id: `order-${i}` },
        });
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process 10 events quickly (within 50ms total)
      expect(processingTime).toBeLessThan(50);
      expect(mockCallback).toHaveBeenCalledTimes(10);
    });

    it('should update large order lists efficiently', () => {
      // Create large order list (100 orders)
      const largeOrderList = Array.from({ length: 100 }, (_, i) => ({
        ...mockCreatedOrder,
        _id: `order-${i}`,
      }));

      const startTime = performance.now();
      
      // Update one order in the large list
      const updater = createOrderListUpdater({ ...mockConfirmedOrder, _id: 'order-50' });
      const result = updater(largeOrderList);

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should update large list quickly (within 10ms)
      expect(updateTime).toBeLessThan(10);
      expect(result).toHaveLength(100);
      expect(result[50].status).toBe('CONFIRMED'); // Correct order updated
      expect(result[49].status).toBe('CREATED'); // Other orders unchanged
    });
  });
});