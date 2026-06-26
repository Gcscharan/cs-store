import { determineChannels, DeliveryChannel, NotificationCategory, NotificationPriority } from "../../../src/domains/communication/services/channelRouter";
import { User } from "../../../src/models/User";

// Mock the User model
jest.mock("../../../src/models/User", () => ({
  User: {
    findById: jest.fn(),
  },
}));

// Mock the logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFindById = User.findById as jest.Mock;

describe("Channel Router - determineChannels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const allChannels: DeliveryChannel[] = ["in_app", "push", "socket"];

  describe("P0 Priority Override", () => {
    it("should always include push and in_app for P0 regardless of user preferences", async () => {
      // User has completely disabled push notifications
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: false },
              inapp: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P0", allChannels);

      expect(channels).toContain("push");
      expect(channels).toContain("in_app");
    });

    it("should include socket for P0 if template includes socket", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: false },
              inapp: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "payment", "P0", ["in_app", "push", "socket"]);

      expect(channels).toContain("push");
      expect(channels).toContain("in_app");
      expect(channels).toContain("socket");
    });

    it("should NOT include socket for P0 if template does not include socket", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {},
          }),
        }),
      });

      const channels = await determineChannels("user123", "payment", "P0", ["in_app", "push"]);

      expect(channels).toContain("push");
      expect(channels).toContain("in_app");
      expect(channels).not.toContain("socket");
    });

    it("should not query user preferences for P0 (optimization)", async () => {
      const channels = await determineChannels("user123", "order", "P0", allChannels);

      expect(mockFindById).not.toHaveBeenCalled();
      expect(channels).toContain("push");
      expect(channels).toContain("in_app");
    });
  });

  describe("Default Behavior (No Preferences Set)", () => {
    it("should return all template channels when user has no preferences", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: undefined,
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).toEqual(allChannels);
    });

    it("should return all template channels when preferences object is empty", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {},
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P2", allChannels);

      expect(channels).toEqual(allChannels);
    });

    it("should return all template channels when user is not found", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const channels = await determineChannels("user123", "delivery", "P1", allChannels);

      expect(channels).toEqual(allChannels);
    });

    it("should return all template channels on database error (fail-open)", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error("DB connection failed")),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).toEqual(allChannels);
    });
  });

  describe("Per-Channel Filtering (push.enabled)", () => {
    it("should exclude push when push.enabled is false", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).not.toContain("push");
      expect(channels).toContain("in_app");
      expect(channels).toContain("socket");
    });

    it("should include push when push.enabled is true", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: true, categories: { myOrders: true } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).toContain("push");
    });

    it("should exclude in_app when inapp.enabled is false", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              inapp: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).not.toContain("in_app");
      expect(channels).not.toContain("socket"); // socket follows inapp preferences
      expect(channels).toContain("push");
    });
  });

  describe("Per-Category Filtering", () => {
    it("should exclude push when myOrders category is disabled for order notifications", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: true, categories: { myOrders: false } },
              inapp: { enabled: true, categories: { myOrders: true } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P2", allChannels);

      expect(channels).not.toContain("push");
      expect(channels).toContain("in_app");
    });

    it("should exclude push for payment notifications when silentPay is disabled", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: true, categories: { silentPay: false } },
              inapp: { enabled: true, categories: { silentPay: true } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "payment", "P2", allChannels);

      expect(channels).not.toContain("push");
      expect(channels).toContain("in_app");
    });

    it("should exclude push for promo notifications when newOffers is disabled", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: true, categories: { newOffers: false } },
              inapp: { enabled: true, categories: { newOffers: true } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "promo", "P3", ["in_app", "push"]);

      expect(channels).not.toContain("push");
      expect(channels).toContain("in_app");
    });

    it("should include all channels when all categories are enabled", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: true, categories: { myOrders: true } },
              inapp: { enabled: true, categories: { myOrders: true } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).toEqual(allChannels);
    });
  });

  describe("Socket Channel Follows In-App Preferences", () => {
    it("should exclude socket when inapp is disabled for the category", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: true, categories: { myOrders: true } },
              inapp: { enabled: true, categories: { myOrders: false } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).toContain("push");
      expect(channels).not.toContain("in_app");
      expect(channels).not.toContain("socket");
    });

    it("should include socket when inapp is enabled for the category", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              inapp: { enabled: true, categories: { myOrders: true } },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P2", ["in_app", "socket"]);

      expect(channels).toContain("in_app");
      expect(channels).toContain("socket");
    });
  });

  describe("Template Channel Filtering", () => {
    it("should only return channels that are in templateChannels", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {},
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", ["in_app"]);

      expect(channels).toEqual(["in_app"]);
    });

    it("should handle empty templateChannels", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {},
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P2", []);

      expect(channels).toEqual([]);
    });
  });

  describe("Multiple Priority Levels", () => {
    it("should respect preferences for P1 priority", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P1", allChannels);

      expect(channels).not.toContain("push");
    });

    it("should respect preferences for P2 priority", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "order", "P2", allChannels);

      expect(channels).not.toContain("push");
    });

    it("should respect preferences for P3 priority", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            notificationPreferences: {
              push: { enabled: false },
              inapp: { enabled: false },
            },
          }),
        }),
      });

      const channels = await determineChannels("user123", "promo", "P3", allChannels);

      expect(channels).toEqual([]);
    });
  });
});
