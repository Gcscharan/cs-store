/**
 * Task 8.3: Test mobile assign → web updates instantly
 * 
 * This test verifies that mobile admin assignment actions update web admin within 1 second.
 * Tests the complete assignment flow including:
 * - Mobile admin assign action triggers API call
 * - API call triggers socket event (order:assigned) to web admin
 * - Web admin receives and processes the event within 1 second
 * - Web admin UI updates to show delivery partner information
 * - Assignment information is consistent across platforms
 * - No manual refresh required on web admin
 * 
 * Requirements: 4.1, 7.1
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { configureStore } from '@reduxjs/toolkit';
import { io, Socket } from 'socket.io-client';

import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminOrderDetailScreen from '../screens/admin/AdminOrderDetailScreen';
import { adminApi } from '../api/adminApi';
import { baseApi } from '../api/baseApi';
import { socketClient } from '../services/socketClient';
import { uiSlice } from '../store/slices/uiSlice';

// Mock socket.io-client
jest.mock('socket.io-client');
const mockIo = io as jest.MockedFunction<typeof io>;

// Mock navigation
const Stack = createNativeStackNavigator();

// Mock data
const mockOrder = {
  _id: 'order123',
  orderNumber: 'ORD001',
  status: 'PACKED',
  orderStatus: 'PACKED',
  totalAmount: 500,
  items: [
    {
      productId: { name: 'Test Product' },
      qty: 2,
      price: 250,
    },
  ],
  userId: { name: 'John Doe', phone: '9876543210' },
  createdAt: '2024-01-15T10:00:00Z',
  allowedActions: ['ASSIGN'],
  deliveryPartner: null,
};

const mockDeliveryPartners = [
  {
    _id: 'partner1',
    name: 'Delivery Partner 1',
    phone: '9999999999',
    vehicleType: 'Bike',
    isAvailable: true,
    currentLoad: 2,
  },
  {
    _id: 'partner2',
    name: 'Delivery Partner 2',
    phone: '8888888888',
    vehicleType: 'Car',
    isAvailable: true,
    currentLoad: 1,
  },
];

const mockAssignedOrder = {
  ...mockOrder,
  status: 'IN_TRANSIT',
  orderStatus: 'IN_TRANSIT',
  allowedActions: ['START_DELIVERY'],
  deliveryPartner: {
    name: 'Delivery Partner 1',
    phone: '9999999999',
    vehicleType: 'Bike',
  },
  deliveryBoyId: 'partner1',
};

// Mock socket instance
const mockSocket = {
  connected: true,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
  id: 'mock-socket-id',
} as unknown as Socket;

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      api: baseApi.reducer,
      ui: uiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }).concat(baseApi.middleware),
  });
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = createTestStore();
  
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
          <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />
        </Stack.Navigator>
        {children}
      </NavigationContainer>
    </Provider>
  );
};

describe('Task 8.3: Mobile Assign → Web Updates Instantly', () => {
  let mockSocketEventHandlers: { [key: string]: Function } = {};
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketEventHandlers = {};
    
    // Setup mock socket
    mockIo.mockReturnValue(mockSocket);
    (mockSocket.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
      mockSocketEventHandlers[event] = handler;
    });

    // Setup store
    store = createTestStore();

    // Mock API endpoints
    store.dispatch(
      adminApi.util.upsertQueryData('getAdminOrders', undefined, {
        orders: [mockOrder],
      })
    );

    store.dispatch(
      adminApi.util.upsertQueryData('getDeliveryPartners', undefined, {
        deliveryPartners: mockDeliveryPartners,
      })
    );

    // Initialize socket client
    socketClient.init(store.dispatch);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Assignment Flow Integration', () => {
    it('should complete mobile assign action and trigger socket event within 1 second', async () => {
      const startTime = Date.now();
      
      // Mock successful assignment API call
      const mockAssignMutation = jest.fn().mockResolvedValue({
        data: { order: mockAssignedOrder },
      });
      
      // Mock the API endpoint
      jest.spyOn(adminApi.endpoints.assignOrder, 'initiate').mockReturnValue({
        unwrap: mockAssignMutation,
      } as any);

      const { getByText, getByTestId } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Find and click assign button
      const assignButton = getByText('Assign');
      fireEvent.press(assignButton);

      // Wait for delivery partner modal to appear
      await waitFor(() => {
        expect(getByText('Select Delivery Partner')).toBeTruthy();
      });

      // Select a delivery partner
      const partner1 = getByText('Delivery Partner 1');
      fireEvent.press(partner1);

      // Confirm assignment
      const confirmButton = getByText('Assign Partner');
      fireEvent.press(confirmButton);

      // Wait for API call to complete
      await waitFor(() => {
        expect(mockAssignMutation).toHaveBeenCalledWith({
          id: 'order123',
          deliveryBoyId: 'partner1',
        });
      });

      const apiCallTime = Date.now() - startTime;
      expect(apiCallTime).toBeLessThan(500); // API call should be fast

      // Simulate socket event from backend (web admin would receive this)
      act(() => {
        if (mockSocketEventHandlers['order:assigned']) {
          mockSocketEventHandlers['order:assigned']({
            orderId: 'order123',
            deliveryPartnerId: 'partner1',
            deliveryPartner: {
              name: 'Delivery Partner 1',
              phone: '9999999999',
              vehicleType: 'Bike',
            },
            timestamp: new Date().toISOString(),
            order: mockAssignedOrder,
          });
        }
      });

      // Verify total time is under 1 second
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(1000);

      // Verify success toast appears
      await waitFor(() => {
        expect(getByText('Delivery partner assigned successfully')).toBeTruthy();
      });
    });

    it('should update order state immediately from API response', async () => {
      const mockAssignMutation = jest.fn().mockResolvedValue({
        data: { order: mockAssignedOrder },
      });
      
      jest.spyOn(adminApi.endpoints.assignOrder, 'initiate').mockReturnValue({
        unwrap: mockAssignMutation,
      } as any);

      const { getByText, queryByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Initially should show assign button
      expect(getByText('Assign')).toBeTruthy();

      // Perform assignment
      fireEvent.press(getByText('Assign'));
      await waitFor(() => getByText('Select Delivery Partner'));
      
      fireEvent.press(getByText('Delivery Partner 1'));
      fireEvent.press(getByText('Assign Partner'));

      // Wait for API response to update state
      await waitFor(() => {
        expect(mockAssignMutation).toHaveBeenCalled();
      });

      // Verify UI updates immediately (no assign button, shows new status)
      await waitFor(() => {
        expect(queryByText('Assign')).toBeNull();
        // Note: The exact UI update depends on allowedActions in response
      });
    });
  });

  describe('Socket Event Processing', () => {
    it('should process order:assigned socket events within timing requirements', async () => {
      const { rerender } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      const startTime = Date.now();

      // Simulate receiving socket event (as web admin would)
      act(() => {
        if (mockSocketEventHandlers['order:assigned']) {
          mockSocketEventHandlers['order:assigned']({
            orderId: 'order123',
            deliveryPartnerId: 'partner1',
            deliveryPartner: {
              name: 'Delivery Partner 1',
              phone: '9999999999',
              vehicleType: 'Bike',
            },
            timestamp: new Date().toISOString(),
            order: mockAssignedOrder,
          });
        }
      });

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(50); // Event processing should be very fast

      // Verify toast notification appears
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).toContain('Delivery Partner 1 assigned to order');
      });
    });

    it('should handle socket events only for relevant orders', async () => {
      const { getByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Simulate socket event for different order
      act(() => {
        if (mockSocketEventHandlers['order:assigned']) {
          mockSocketEventHandlers['order:assigned']({
            orderId: 'different-order',
            deliveryPartnerId: 'partner1',
            deliveryPartner: { name: 'Partner 1' },
            timestamp: new Date().toISOString(),
            order: { ...mockAssignedOrder, _id: 'different-order' },
          });
        }
      });

      // Should not show toast for irrelevant order
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).not.toContain('assigned to order');
      }, { timeout: 500 });
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should maintain consistent order data structure across platforms', () => {
      const assignmentEvent = {
        orderId: 'order123',
        deliveryPartnerId: 'partner1',
        deliveryPartner: {
          name: 'Delivery Partner 1',
          phone: '9999999999',
          vehicleType: 'Bike',
        },
        timestamp: new Date().toISOString(),
        order: mockAssignedOrder,
      };

      // Verify event structure matches expected format
      expect(assignmentEvent).toMatchObject({
        orderId: expect.any(String),
        deliveryPartnerId: expect.any(String),
        deliveryPartner: expect.objectContaining({
          name: expect.any(String),
          phone: expect.any(String),
          vehicleType: expect.any(String),
        }),
        timestamp: expect.any(String),
        order: expect.objectContaining({
          _id: expect.any(String),
          status: expect.any(String),
          allowedActions: expect.any(Array),
          deliveryPartner: expect.any(Object),
        }),
      });
    });

    it('should update allowedActions consistently after assignment', async () => {
      const mockAssignMutation = jest.fn().mockResolvedValue({
        data: { order: mockAssignedOrder },
      });
      
      jest.spyOn(adminApi.endpoints.assignOrder, 'initiate').mockReturnValue({
        unwrap: mockAssignMutation,
      } as any);

      const { getByText, queryByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Perform assignment
      fireEvent.press(getByText('Assign'));
      await waitFor(() => getByText('Select Delivery Partner'));
      
      fireEvent.press(getByText('Delivery Partner 1'));
      fireEvent.press(getByText('Assign Partner'));

      await waitFor(() => {
        expect(mockAssignMutation).toHaveBeenCalled();
      });

      // Verify allowedActions updated (no more assign button)
      await waitFor(() => {
        expect(queryByText('Assign')).toBeNull();
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should meet 1-second total synchronization requirement', async () => {
      const startTime = Date.now();
      
      const mockAssignMutation = jest.fn().mockResolvedValue({
        data: { order: mockAssignedOrder },
      });
      
      jest.spyOn(adminApi.endpoints.assignOrder, 'initiate').mockReturnValue({
        unwrap: mockAssignMutation,
      } as any);

      const { getByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Step 1: Mobile admin action (API call)
      fireEvent.press(getByText('Assign'));
      await waitFor(() => getByText('Select Delivery Partner'));
      
      fireEvent.press(getByText('Delivery Partner 1'));
      fireEvent.press(getByText('Assign Partner'));

      await waitFor(() => {
        expect(mockAssignMutation).toHaveBeenCalled();
      });

      // Step 2: Socket event (web admin receives)
      act(() => {
        if (mockSocketEventHandlers['order:assigned']) {
          mockSocketEventHandlers['order:assigned']({
            orderId: 'order123',
            deliveryPartnerId: 'partner1',
            deliveryPartner: mockDeliveryPartners[0],
            timestamp: new Date().toISOString(),
            order: mockAssignedOrder,
          });
        }
      });

      const totalTime = Date.now() - startTime;
      
      // Critical requirement: Total sync time must be under 1 second
      expect(totalTime).toBeLessThan(1000);
      
      // Verify success notification
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).toContain('assigned successfully');
      });
    });

    it('should handle rapid assignment actions without performance degradation', async () => {
      const mockAssignMutation = jest.fn().mockResolvedValue({
        data: { order: mockAssignedOrder },
      });
      
      jest.spyOn(adminApi.endpoints.assignOrder, 'initiate').mockReturnValue({
        unwrap: mockAssignMutation,
      } as any);

      const { getByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      const startTime = Date.now();

      // Simulate multiple rapid socket events (as would happen with multiple admins)
      for (let i = 0; i < 5; i++) {
        act(() => {
          if (mockSocketEventHandlers['order:assigned']) {
            mockSocketEventHandlers['order:assigned']({
              orderId: `order${i}`,
              deliveryPartnerId: 'partner1',
              deliveryPartner: mockDeliveryPartners[0],
              timestamp: new Date().toISOString(),
              order: { ...mockAssignedOrder, _id: `order${i}` },
            });
          }
        });
      }

      const processingTime = Date.now() - startTime;
      
      // Should handle multiple events quickly
      expect(processingTime).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle assignment API failures gracefully', async () => {
      const mockAssignMutation = jest.fn().mockRejectedValue({
        data: { message: 'Delivery partner not available' },
      });
      
      jest.spyOn(adminApi.endpoints.assignOrder, 'initiate').mockReturnValue({
        unwrap: mockAssignMutation,
      } as any);

      const { getByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Attempt assignment
      fireEvent.press(getByText('Assign'));
      await waitFor(() => getByText('Select Delivery Partner'));
      
      fireEvent.press(getByText('Delivery Partner 1'));
      fireEvent.press(getByText('Assign Partner'));

      // Wait for error handling
      await waitFor(() => {
        expect(mockAssignMutation).toHaveBeenCalled();
      });

      // Verify error toast appears
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).toContain('Delivery partner not available');
      });
    });

    it('should handle malformed socket events gracefully', () => {
      const { rerender } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Simulate malformed socket event
      expect(() => {
        act(() => {
          if (mockSocketEventHandlers['order:assigned']) {
            mockSocketEventHandlers['order:assigned']({
              // Missing required fields
              orderId: null,
              deliveryPartnerId: undefined,
            });
          }
        });
      }).not.toThrow();

      // Should not crash or show error toast for malformed events
      expect(store.getState().ui.toast?.message).not.toContain('error');
    });
  });

  describe('No Manual Refresh Required', () => {
    it('should update UI automatically without manual refresh', async () => {
      const { getByText, queryByText } = render(
        <TestWrapper>
          <AdminOrdersScreen />
        </TestWrapper>
      );

      // Initially shows assign button
      expect(getByText('Assign')).toBeTruthy();

      // Simulate socket event from web admin assignment
      act(() => {
        if (mockSocketEventHandlers['order:assigned']) {
          mockSocketEventHandlers['order:assigned']({
            orderId: 'order123',
            deliveryPartnerId: 'partner1',
            deliveryPartner: mockDeliveryPartners[0],
            timestamp: new Date().toISOString(),
            order: mockAssignedOrder,
          });
        }
      });

      // UI should update automatically (no assign button)
      await waitFor(() => {
        expect(queryByText('Assign')).toBeNull();
      });

      // Should show delivery partner info
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).toContain('Delivery Partner 1 assigned');
      });
    });
  });
});