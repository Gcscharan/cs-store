import { jest } from "@jest/globals";

// Mock Twilio message response
export const mockTwilioMessage = {
  sid: "SMtest123",
  dateCreated: "2023-01-01T00:00:00.000Z",
  dateUpdated: "2023-01-01T00:00:00.000Z",
  dateSent: "2023-01-01T00:00:00.000Z",
  accountSid: "ACtest123",
  to: "+919876543210",
  from: "+1234567890",
  body: "Test message",
  status: "sent",
  direction: "outbound-api",
  price: null,
  priceUnit: null,
  apiVersion: "2010-04-01",
  uri: "/2010-04-01/Accounts/ACtest123/Messages/SMtest123",
};

// Mock Twilio client
export const mockTwilioClient = {
  messages: {
    create: jest.fn().mockResolvedValue(mockTwilioMessage),
  },
};

// Helper functions for test setup
export function mockTwilioMessageCreate(overrides: any = {}) {
  const message = { ...mockTwilioMessage, ...overrides };
  mockTwilioClient.messages.create.mockResolvedValueOnce(message);
  return message;
}

export function mockTwilioMessageCreateError(error: any) {
  mockTwilioClient.messages.create.mockRejectedValueOnce(error);
}

export function clearAllMocks() {
  mockTwilioClient.messages.create.mockClear();
}
