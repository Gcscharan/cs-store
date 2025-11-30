import { jest } from "@jest/globals";

// Mock Razorpay order creation response
export const mockRazorpayOrder = {
  id: "order_test123",
  entity: "order",
  amount: 50000,
  amount_paid: 0,
  amount_due: 50000,
  currency: "INR",
  receipt: "receipt_test123",
  offer_id: null,
  status: "created",
  attempts: 0,
  notes: [],
  created_at: 1234567890,
};

// Mock Razorpay payment capture response
export const mockRazorpayPayment = {
  id: "pay_test123",
  entity: "payment",
  amount: 50000,
  currency: "INR",
  status: "captured",
  order_id: "order_test123",
  invoice_id: null,
  international: false,
  method: "card",
  amount_refunded: 0,
  refund_status: null,
  captured: true,
  description: "Test payment",
  card_id: "card_test123",
  bank: null,
  wallet: null,
  vpa: null,
  email: "test@example.com",
  contact: "+919876543210",
  notes: {},
  fee: 0,
  tax: 0,
  created_at: 1234567890,
};

// Mock Razorpay instance
export const mockRazorpayInstance = {
  orders: {
    create: jest.fn().mockResolvedValue(mockRazorpayOrder),
  },
  payments: {
    capture: jest.fn().mockResolvedValue(mockRazorpayPayment),
  },
};

// Helper functions for test setup
export function mockRazorpayOrderCreate(overrides: any = {}) {
  const order = { ...mockRazorpayOrder, ...overrides };
  mockRazorpayInstance.orders.create.mockResolvedValueOnce(order);
  return order;
}

export function mockRazorpayPaymentCapture(overrides: any = {}) {
  const payment = { ...mockRazorpayPayment, ...overrides };
  mockRazorpayInstance.payments.capture.mockResolvedValueOnce(payment);
  return payment;
}

export function mockRazorpayOrderCreateError(error: any) {
  mockRazorpayInstance.orders.create.mockRejectedValueOnce(error);
}

export function mockRazorpayPaymentCaptureError(error: any) {
  mockRazorpayInstance.payments.capture.mockRejectedValueOnce(error);
}

export function clearAllMocks() {
  mockRazorpayInstance.orders.create.mockClear();
  mockRazorpayInstance.payments.capture.mockClear();
}
