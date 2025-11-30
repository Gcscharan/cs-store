import { jest } from "@jest/globals";

// Mock Fast2SMS success response
export const mockFast2SmsSuccess = {
  return: true,
  message: "SMS sent successfully",
  request_id: "req_test123",
  status_code: 200,
};

// Mock Fast2SMS error response
export const mockFast2SmsError = {
  return: false,
  message: "Invalid API key",
  status_code: 401,
};

// Mock Fast2SMS payment/balance error
export const mockFast2SmsPaymentError = {
  return: false,
  message: "Insufficient balance",
  status_code: 999,
};

// Helper function to mock Fast2SMS HTTP request
export function mockFast2SmsRequest(response: any) {
  // Mock the https module used in sendViaFast2SMS
  const mockRequest = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === "error") {
        // Don't trigger error by default
      }
    }),
  };

  const mockResponse = {
    statusCode: response.status_code || 200,
    headers: {},
    on: jest.fn((event, callback) => {
      if (event === "data") {
        callback(JSON.stringify(response));
      }
      if (event === "end") {
        callback();
      }
    }),
  };

  // Mock https.request
  jest.doMock("https", () => ({
    request: jest.fn(() => mockRequest),
  }));

  return { mockRequest, mockResponse };
}

// Helper functions for test setup
export function mockFast2SmsSuccessResponse(overrides: any = {}) {
  const response = { ...mockFast2SmsSuccess, ...overrides };
  return mockFast2SmsRequest(response);
}

export function mockFast2SmsErrorResponse(overrides: any = {}) {
  const response = { ...mockFast2SmsError, ...overrides };
  return mockFast2SmsRequest(response);
}

export function mockFast2SmsPaymentErrorResponse(overrides: any = {}) {
  const response = { ...mockFast2SmsPaymentError, ...overrides };
  return mockFast2SmsRequest(response);
}

export function mockFast2SmsNetworkError() {
  const mockRequest = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === "error") {
        callback(new Error("Network error"));
      }
    }),
  };

  jest.doMock("https", () => ({
    request: jest.fn(() => mockRequest),
  }));

  return mockRequest;
}
