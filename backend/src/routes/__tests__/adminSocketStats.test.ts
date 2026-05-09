/**
 * Unit tests for GET /admin/socket-stats
 * Validates: Requirements 10.6
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import adminRouter from "../admin";

// Mock heavy dependencies that admin.ts imports transitively
jest.mock("../../controllers/adminController", () => ({
  getStats: (_req: any, res: any) => res.json({}),
  exportOrders: (_req: any, res: any) => res.json({}),
  getAdminProfile: (_req: any, res: any) => res.json({}),
  getUsers: (_req: any, res: any) => res.json({}),
  getAdminProducts: (_req: any, res: any) => res.json({}),
  getAdminOrders: (_req: any, res: any) => res.json({}),
  getAdminDeliveryBoys: (_req: any, res: any) => res.json({}),
  getDashboardStats: (_req: any, res: any) => res.json({}),
  updateProduct: (_req: any, res: any) => res.json({}),
  deleteProduct: (_req: any, res: any) => res.json({}),
  makeDeliveryBoy: (_req: any, res: any) => res.json({}),
  approveDeliveryBoy: (_req: any, res: any) => res.json({}),
  suspendDeliveryBoy: (_req: any, res: any) => res.json({}),
  computeRoutes: (_req: any, res: any) => res.json({}),
  listRoutes: (_req: any, res: any) => res.json({}),
  assignRoute: (_req: any, res: any) => res.json({}),
  assignComputedCluster: (_req: any, res: any) => res.json({}),
  getRouteStatus: (_req: any, res: any) => res.json({}),
  listRecentAssignedRoutes: (_req: any, res: any) => res.json({}),
  getRouteDetail: (_req: any, res: any) => res.json({}),
  purgeOrders: (_req: any, res: any) => res.json({}),
  getGstReportHandler: (_req: any, res: any) => res.json({}),
  getRouteOverview: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../domains/catalog/controllers/productController", () => ({
  createProduct: (_req: any, res: any) => res.json({}),
  updateProduct: (_req: any, res: any) => res.json({}),
  publishProduct: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../controllers/orderAssignmentController", () => ({
  assignDeliveryBoyToOrder: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../controllers/versionController", () => ({
  getVersionHistory: (_req: any, res: any) => res.json({}),
  getVersion: (_req: any, res: any) => res.json({}),
  getVersionDiff: (_req: any, res: any) => res.json({}),
  rollbackProduct: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../controllers/videoController", () => ({
  uploadVideo: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../controllers/lowStockNotificationController", () => ({
  registerDevice: (_req: any, res: any) => res.json({}),
  unregisterDevice: (_req: any, res: any) => res.json({}),
  getNotifications: (_req: any, res: any) => res.json({}),
  markNotificationAsRead: (_req: any, res: any) => res.json({}),
  deleteNotification: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../domains/operations/controllers/deliveryOrderController", () => ({
  getAdminCodCollection: (_req: any, res: any) => res.json({}),
  getAdminOrderAttempt: (_req: any, res: any) => res.json({}),
}));

jest.mock("../../middleware/auditLog", () => ({
  auditLog: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../../domains/orders/services/orderStateService", () => ({
  orderStateService: { transition: jest.fn() },
}));

jest.mock("../../domains/delivery/services/autoAssignmentRunner", () => ({
  enqueueAutoAssignment: jest.fn(),
}));

jest.mock("../../domains/user/services/UserAccountService", () => ({
  UserAccountService: jest.fn().mockImplementation(() => ({
    deleteAccount: jest.fn(),
  })),
}));

// Mock socketMetrics with known values
jest.mock("../../domains/delivery/services/deliverySocketEmitter", () => ({
  socketMetrics: {
    eventsEmittedPerMin: 5,
    eventsDroppedThrottlePerMin: 2,
    syncRequestsPerMin: 1,
    ackRetriesPerMin: 0,
    totalEventsEmitted: 100,
    totalSyncRequests: 10,
    totalAckFailures: 3,
  },
}));

const mockMetrics = {
  eventsEmittedPerMin: 5,
  eventsDroppedThrottlePerMin: 2,
  syncRequestsPerMin: 1,
  ackRetriesPerMin: 0,
  totalEventsEmitted: 100,
  totalSyncRequests: 10,
  totalAckFailures: 3,
};

// Mock auth middleware
jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    // Simulate authenticated user set by a real token check
    (req as any).user = (req as any)._mockUser;
    next();
  },
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!roles.includes(user.role)) return res.status(403).json({ message: "Forbidden" });
    next();
  },
}));

// Build a minimal Express app that mounts the admin router
function buildApp(mockUser?: { role: string }) {
  const app = express();
  app.use(express.json());

  // Inject mock user into request before the router handles it
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any)._mockUser = mockUser;
    next();
  });

  // Provide a mock io instance via app.set
  const mockRooms = new Map<string, Set<string>>([
    ["admin_room", new Set(["socket1", "socket2"])],
    ["delivery:rider1", new Set(["socket3"])],
    // socket-id rooms (should be filtered out)
    ["socket1", new Set(["socket1"])],
    ["socket2", new Set(["socket2"])],
    ["socket3", new Set(["socket3"])],
  ]);

  const mockSockets = new Map<string, any>([
    ["socket1", {}],
    ["socket2", {}],
    ["socket3", {}],
  ]);

  app.set("io", {
    sockets: {
      adapter: { rooms: mockRooms },
      sockets: mockSockets,
    },
  });

  app.use("/admin", adminRouter);
  return app;
}

describe("GET /admin/socket-stats", () => {
  it("returns 200 with correct metrics shape for admin user", async () => {
    const app = buildApp({ role: "admin" });

    const res = await request(app).get("/admin/socket-stats");

    expect(res.status).toBe(200);

    // Verify all SocketMetrics fields are present
    expect(res.body).toMatchObject({
      eventsEmittedPerMin: mockMetrics.eventsEmittedPerMin,
      eventsDroppedThrottlePerMin: mockMetrics.eventsDroppedThrottlePerMin,
      syncRequestsPerMin: mockMetrics.syncRequestsPerMin,
      ackRetriesPerMin: mockMetrics.ackRetriesPerMin,
      totalEventsEmitted: mockMetrics.totalEventsEmitted,
      totalSyncRequests: mockMetrics.totalSyncRequests,
      totalAckFailures: mockMetrics.totalAckFailures,
    });

    // connectedSocketsPerRoom should only include named rooms (not socket-id rooms)
    expect(res.body.connectedSocketsPerRoom).toEqual({
      admin_room: 2,
      "delivery:rider1": 1,
    });
  });

  it("returns 401 for unauthenticated request", async () => {
    const app = buildApp(undefined); // no user

    const res = await request(app).get("/admin/socket-stats");

    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const app = buildApp({ role: "delivery" });

    const res = await request(app).get("/admin/socket-stats");

    expect(res.status).toBe(403);
  });

  it("returns connectedSocketsPerRoom as empty object when io has no rooms", async () => {
    const app = buildApp({ role: "admin" });

    // Override io with empty rooms
    app.set("io", {
      sockets: {
        adapter: { rooms: new Map() },
        sockets: new Map(),
      },
    });

    const res = await request(app).get("/admin/socket-stats");

    expect(res.status).toBe(200);
    expect(res.body.connectedSocketsPerRoom).toEqual({});
  });
});
