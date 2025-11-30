import { jest } from "@jest/globals";

// Mock Resend email response
export const mockResendResponse = {
  id: "email_test123",
  from: "test@example.com",
  to: ["recipient@example.com"],
  subject: "Test Email",
  html: "<p>Test email content</p>",
  text: "Test email content",
  createdAt: "2023-01-01T00:00:00.000Z",
};

// Mock Nodemailer response
export const mockNodemailerResponse = {
  messageId: "test123@example.com",
  envelope: {
    from: "test@example.com",
    to: ["recipient@example.com"],
  },
  accepted: ["recipient@example.com"],
  rejected: [],
  pending: [],
  pending: [],
};

// Mock Resend instance
export const mockResend = {
  emails: {
    send: jest.fn().mockResolvedValue(mockResendResponse),
  },
};

// Mock Nodemailer transporter
export const mockNodemailerTransporter = {
  sendMail: jest.fn().mockResolvedValue(mockNodemailerResponse),
  verify: jest.fn().mockResolvedValue(true),
  close: jest.fn(),
};

// Mock createTransport
export const mockCreateTransport = jest.fn(() => mockNodemailerTransporter);

// Helper functions for test setup
export function mockResendSendEmail(overrides: any = {}) {
  const response = { ...mockResendResponse, ...overrides };
  mockResend.emails.send.mockResolvedValueOnce(response);
  return response;
}

export function mockResendSendEmailError(error: any) {
  mockResend.emails.send.mockRejectedValueOnce(error);
}

export function mockNodemailerSendEmail(overrides: any = {}) {
  const response = { ...mockNodemailerResponse, ...overrides };
  mockNodemailerTransporter.sendMail.mockResolvedValueOnce(response);
  return response;
}

export function mockNodemailerSendEmailError(error: any) {
  mockNodemailerTransporter.sendMail.mockRejectedValueOnce(error);
}

export function clearAllMocks() {
  mockResend.emails.send.mockClear();
  mockNodemailerTransporter.sendMail.mockClear();
  mockNodemailerTransporter.verify.mockClear();
  mockCreateTransport.mockClear();
}
