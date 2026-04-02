import { jest } from '@jest/globals';
import { setServices, resetServices } from '../../src/services/serviceRegistry';

// Mock the pincode resolution system using service registry
export function mockPincodeResolution() {
  // Create jest.fn() mocks so they can be spied on
  const validatePincodeMock = jest.fn().mockImplementation(async (pincode: string) => {
    // Simulate invalid pincodes
    if (pincode === '000000' || pincode === '999999' || !pincode || pincode.length !== 6) {
      return {
        valid: false,
        pincode,
      };
    }
    
    return {
      valid: true,
      pincode,
      suggestedCity: 'Bangalore',
      suggestedState: 'Karnataka',
      suggestedDistrict: 'Bangalore Urban',
      postOffices: [{
        pincode,
        postOfficeName: 'Bangalore',
        district: 'Bangalore Urban',
        state: 'Karnataka',
        stateCode: 'KA',
        region: 'South',
        country: 'India',
      }],
    };
  });

  const resolvePincodeMock = jest.fn().mockImplementation(async (pincode: string) => {
    // Simulate outside India for test pincode 999999
    if (pincode === '999999') return null;
    
    return {
      state: 'Karnataka',
      postal_district: 'Bangalore Urban',
      admin_district: 'Bangalore Urban',
    };
  });

  // Use service registry for proper DI instead of Jest mocks
  setServices({
    geocoding: {
      smartGeocode: async () => ({
        lat: 12.9716,
        lng: 77.5946,
        formattedAddress: "Bangalore, Karnataka",
        source: 'mock',
      }),
      geocodeByPincode: async () => ({
        lat: 12.9716,
        lng: 77.5946,
        source: 'pincode',
      }),
    },
    pincode: {
      validatePincode: validatePincodeMock,
      resolvePincodeAuthoritatively: resolvePincodeMock,
    },
  });

  // Return mocks so tests can spy on them
  return {
    validatePincodeMock,
    resolvePincodeMock,
  };
}

// Reset services after tests
export function resetMocks() {
  resetServices();
}

export function mockGPSLocation(overrides: any = {}) {
  return {
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 30,
    ...overrides,
  };
}

export function mockReverseGeocode(overrides: any = {}) {
  return {
    name: '123 Main Street',
    area: 'MG Road',
    postalCode: '560001',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    ...overrides,
  };
}

export function mockPincodeCheck(pincode: string, result: any) {
  // Use spyOn for runtime mocking instead of doMock
  const pincodeValidator = require('../../src/services/pincodeValidator');
  const authoritativeResolver = require('../../src/utils/authoritativePincodeResolver');
  
  // Mock the pincode validator service
  jest.spyOn(pincodeValidator, 'validatePincode').mockResolvedValue({
    valid: result.deliverable ?? true,
    pincode,
    suggestedCity: result.cities?.[0] ?? 'Bangalore',
    suggestedState: result.state ?? 'Karnataka',
    suggestedDistrict: result.district ?? 'Bangalore Urban',
    postOffices: [{
      pincode,
      postOfficeName: result.cities?.[0] ?? 'Bangalore',
      district: result.district ?? 'Bangalore Urban',
      state: result.state ?? 'Karnataka',
      stateCode: 'KA',
      region: 'South',
      country: 'India',
    }],
    ...result,
  });

  // Also mock the authoritative resolver to return valid data
  jest.spyOn(authoritativeResolver, 'resolvePincodeAuthoritatively').mockResolvedValue({
    state: result.state ?? 'Karnataka',
    postal_district: result.district ?? 'Bangalore Urban',
    admin_district: result.district ?? 'Bangalore Urban',
  });
  
  return result;
}

export async function mockRazorpayWebhook(data: any) {
  // Simulate Razorpay webhook payload
  const webhookPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: data.razorpayPaymentId || 'pay_test123',
          order_id: data.razorpayOrderId || 'order_test123',
          status: data.status || 'captured',
          amount: data.amount || 50000,
          currency: 'INR',
          method: 'card',
          captured: true,
          created_at: Math.floor(Date.now() / 1000),
        },
      },
      order: {
        entity: {
          id: data.razorpayOrderId || 'order_test123',
          status: 'paid',
        },
      },
    },
  };
  
  // Update order in database using proper webhook context to avoid ILLEGAL_PAID_TRANSITION
  const { Order } = await import('../../src/models/Order');
  await Order.findByIdAndUpdate(
    data.orderId, 
    {
      paymentStatus: 'PAID',
      'paymentIntent.status': 'completed',
      'paymentIntent.razorpayPaymentId': data.razorpayPaymentId || 'pay_test123',
      'paymentIntent.updatedAt': new Date(),
    },
    { 
      context: { paymentStatusSource: "WEBHOOK_PAYMENT_CAPTURED" } 
    } as any
  );
  
  return webhookPayload;
}

export function mockPaymentIntent(overrides: any = {}) {
  return {
    id: 'pi_test123',
    status: 'pending',
    amount: 50000,
    currency: 'INR',
    razorpayOrderId: 'order_test123',
    ...overrides,
  };
}

// Mock BullMQ Queue System
export function mockQueueSystem() {
  jest.doMock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'job_test123' }),
      getJobs: jest.fn().mockResolvedValue([]),
      clean: jest.fn().mockResolvedValue(0),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  }));
}

// Mock External APIs
export function mockExternalAPIs() {
  // Mock Google Maps API
  jest.doMock('@googlemaps/google-maps-services-js', () => ({
    Client: jest.fn().mockImplementation(() => ({
      geocode: jest.fn().mockResolvedValue({
        data: {
          results: [{
            formatted_address: '123 Test Street, Bangalore, Karnataka 560001, India',
            geometry: {
              location: { lat: 12.9716, lng: 77.5946 }
            },
            address_components: [
              { long_name: '560001', types: ['postal_code'] },
              { long_name: 'Bangalore', types: ['locality'] },
              { long_name: 'Karnataka', types: ['administrative_area_level_1'] },
            ]
          }]
        }
      }),
      reverseGeocode: jest.fn().mockResolvedValue({
        data: {
          results: [{
            formatted_address: '123 Test Street, Bangalore, Karnataka 560001, India',
            address_components: [
              { long_name: '560001', types: ['postal_code'] },
              { long_name: 'Bangalore', types: ['locality'] },
              { long_name: 'Karnataka', types: ['administrative_area_level_1'] },
            ]
          }]
        }
      }),
    })),
  }));
}

// Initialize all mocks
export function initializeTestMocks() {
  mockQueueSystem();
  mockExternalAPIs();
}
