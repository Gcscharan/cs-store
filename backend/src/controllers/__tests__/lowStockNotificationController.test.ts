/**
 * Low Stock Notification Controller Tests
 * 
 * Tests for device token registration endpoints (Task 10.2)
 * Requirements: 16.1, 16.2, 16.3, 16.8, 18.3, 18.5
 */

import { Request, Response } from 'express';
import { registerDevice, unregisterDevice } from '../lowStockNotificationController';
import { logger } from '../../utils/logger';
import DeviceToken from '../../models/DeviceToken';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock DeviceToken model (real persistence is exercised in integration tests)
jest.mock('../../models/DeviceToken', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const mockedDeviceToken = DeviceToken as unknown as {
  findOneAndUpdate: jest.Mock;
  deleteMany: jest.Mock;
};

// AuthRequest type
interface AuthRequest extends Request {
  user?: any;
}

describe('Device Token Registration Endpoints (Phase 4 - Placeholder)', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup response mocks
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({
      json: jsonMock,
      send: sendMock,
    });

    mockRes = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    };

    // Default model mock behavior: findOneAndUpdate(...).lean() resolves to a doc
    mockedDeviceToken.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'token-doc-id',
        adminId: 'admin123',
        deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        platform: 'ios',
        lastActiveAt: new Date(),
        createdAt: new Date(),
      }),
    });
    mockedDeviceToken.deleteMany.mockResolvedValue({ deletedCount: 1 });
  });

  describe('registerDevice', () => {
    it('should accept valid device token registration and return 200', async () => {
      // Requirement 16.1, 16.2, 16.3
      mockReq = {
        body: {
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 'ios',
        },
        user: {
          _id: 'admin123',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockedDeviceToken.findOneAndUpdate).toHaveBeenCalledWith(
        { adminId: 'admin123', deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' },
        expect.objectContaining({
          adminId: 'admin123',
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 'ios',
        }),
        expect.objectContaining({ upsert: true, new: true })
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin123',
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 'ios',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[NotificationController] Device token registered',
        expect.objectContaining({
          adminId: 'admin123',
          platform: 'ios',
        })
      );
    });

    it('should accept android platform', async () => {
      mockedDeviceToken.findOneAndUpdate.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: 'token-doc-id',
          adminId: 'admin456',
          deviceToken: 'ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]',
          platform: 'android',
          lastActiveAt: new Date(),
          createdAt: new Date(),
        }),
      });
      mockReq = {
        body: {
          deviceToken: 'ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]',
          platform: 'android',
        },
        user: {
          _id: 'admin456',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'android',
        })
      );
    });

    it('should return 400 for invalid platform', async () => {
      // Requirement 16.8
      mockReq = {
        body: {
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 'windows',
        },
        user: {
          _id: 'admin123',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Invalid platform. Must be 'ios' or 'android'",
      });
    });

    it('should return 400 for missing deviceToken', async () => {
      mockReq = {
        body: {
          platform: 'ios',
        },
        user: {
          _id: 'admin123',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Device token is required and must be a string',
      });
    });

    it('should return 400 for missing platform', async () => {
      mockReq = {
        body: {
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        },
        user: {
          _id: 'admin123',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Platform is required and must be a string',
      });
    });

    it('should return 401 for missing authentication', async () => {
      mockReq = {
        body: {
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 'ios',
        },
        user: undefined,
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });

    it('should return 400 for non-string deviceToken', async () => {
      mockReq = {
        body: {
          deviceToken: 12345,
          platform: 'ios',
        },
        user: {
          _id: 'admin123',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Device token is required and must be a string',
      });
    });

    it('should return 400 for non-string platform', async () => {
      mockReq = {
        body: {
          deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 123,
        },
        user: {
          _id: 'admin123',
        },
      };

      await registerDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Platform is required and must be a string',
      });
    });
  });

  describe('unregisterDevice', () => {
    it('should accept unregister request and return 204', async () => {
      // Requirement 18.3, 18.5
      mockReq = {
        user: {
          _id: 'admin123',
        },
      };

      await unregisterDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
      expect(mockedDeviceToken.deleteMany).toHaveBeenCalledWith({ adminId: 'admin123' });
      expect(logger.info).toHaveBeenCalledWith(
        '[NotificationController] Device token(s) unregistered',
        expect.objectContaining({
          adminId: 'admin123',
        })
      );
    });

    it('should return 401 for missing authentication', async () => {
      mockReq = {
        user: undefined,
      };

      await unregisterDevice(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });
});
