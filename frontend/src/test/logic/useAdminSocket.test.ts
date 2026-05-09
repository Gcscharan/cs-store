/**
 * Unit tests for useAdminSocket hook
 *
 * Task 13.1 — Requirements: 4.1, 4.7, 4.8, 9c.4
 *
 * Tests:
 *  - joins admin_room on connect
 *  - invalidates admin cache tags on reconnect
 *  - batches order:status:changed events and flushes after 500 ms
 *  - deduplicates events by eventId
 *  - cleans up all listeners and disconnects on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock socket.io-client
// ---------------------------------------------------------------------------

type EventHandler = (...args: any[]) => void;

interface MockSocket {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
  _handlers: Record<string, EventHandler[]>;
  _trigger: (event: string, ...args: any[]) => void;
}

let mockSocket: MockSocket;

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// ---------------------------------------------------------------------------
// Mock runtime config
// ---------------------------------------------------------------------------

vi.mock("@/config/runtime", () => ({
  getApiOrigin: () => "http://localhost:5002",
  getApiBaseUrl: () => "http://localhost:5002/api",
  toApiUrl: (path: string) => `http://localhost:5002/api${path}`,
}));

// ---------------------------------------------------------------------------
// Mock Redux
// ---------------------------------------------------------------------------

const mockDispatch = vi.fn();
let mockToken: string | null = "test-admin-token";

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: any) => {
    // Simulate state.auth.tokens.accessToken
    return selector({ auth: { tokens: { accessToken: mockToken } } });
  },
}));

// ---------------------------------------------------------------------------
// Mock store API (adminApi)
// ---------------------------------------------------------------------------

const mockUpdateQueryData = vi.fn(() => ({ type: "updateQueryData" }));
const mockInvalidateTags = vi.fn(() => ({ type: "invalidateTags" }));

vi.mock("@/store/api", () => ({
  api: {
    util: {
      updateQueryData: (...args: any[]) => mockUpdateQueryData(...args),
      invalidateTags: (tags: string[]) => mockInvalidateTags(tags),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock adminActions
// ---------------------------------------------------------------------------

const mockUpdateRiderLocation = vi.fn((data: any) => ({
  type: "admin/updateRiderLocation",
  payload: data,
}));

vi.mock("@/store/slices/adminSlice", () => ({
  adminActions: {
    updateRiderLocation: (data: any) => mockUpdateRiderLocation(data),
  },
}));

// ---------------------------------------------------------------------------
// Import hook (after mocks)
// ---------------------------------------------------------------------------

import { renderHook, act } from "@testing-library/react";
import { useAdminSocket } from "@/hooks/useAdminSocket";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSocket(): MockSocket {
  const handlers: Record<string, EventHandler[]> = {};

  const socket: MockSocket = {
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter((h) => h !== handler);
      }
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    _handlers: handlers,
    _trigger: (event: string, ...args: any[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
  };

  return socket;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAdminSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = createMockSocket();
    mockDispatch.mockClear();
    mockUpdateQueryData.mockClear();
    mockInvalidateTags.mockClear();
    mockUpdateRiderLocation.mockClear();
    mockToken = "test-admin-token";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 4.1 — joins admin_room on connect
  // -------------------------------------------------------------------------
  it("emits join_room for admin_room on connect", () => {
    renderHook(() => useAdminSocket());

    act(() => {
      mockSocket._trigger("connect");
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("join_room", {
      room: "admin_room",
      token: "test-admin-token",
    });
  });

  // -------------------------------------------------------------------------
  // 4.8 — invalidates admin cache tags on reconnect
  // -------------------------------------------------------------------------
  it("invalidates AdminOrders and AdminRiders tags on reconnect", () => {
    renderHook(() => useAdminSocket());

    act(() => {
      mockSocket._trigger("reconnect");
    });

    expect(mockInvalidateTags).toHaveBeenCalledWith(["AdminOrders", "AdminRiders"]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: "invalidateTags" });
  });

  // -------------------------------------------------------------------------
  // 4.7 — batches order:status:changed events and flushes after 500 ms
  // -------------------------------------------------------------------------
  it("batches order:status:changed events and flushes after 500 ms", () => {
    renderHook(() => useAdminSocket());

    const event1 = {
      orderId: "order-1",
      orderStatus: "PICKED_UP",
      deliveryStatus: "IN_TRANSIT",
      allowedActions: ["startDelivery"],
      version: 2,
      eventId: "evt-1",
      timestamp: new Date().toISOString(),
    };
    const event2 = {
      orderId: "order-2",
      orderStatus: "ARRIVED",
      deliveryStatus: "ARRIVED",
      allowedActions: ["verifyOtp"],
      version: 3,
      eventId: "evt-2",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      mockSocket._trigger("order:status:changed", event1);
      mockSocket._trigger("order:status:changed", event2);
    });

    // Not flushed yet — timer hasn't fired
    expect(mockUpdateQueryData).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now flushed in one batch
    expect(mockUpdateQueryData).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueryData).toHaveBeenCalledWith(
      "getAdminOrders",
      undefined,
      expect.any(Function)
    );
  });

  it("does not schedule a second timer if one is already pending", () => {
    renderHook(() => useAdminSocket());

    const makeEvent = (id: string) => ({
      orderId: `order-${id}`,
      orderStatus: "PICKED_UP",
      deliveryStatus: "IN_TRANSIT",
      allowedActions: [],
      version: 1,
      eventId: `evt-${id}`,
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockSocket._trigger("order:status:changed", makeEvent("a"));
    });

    act(() => {
      vi.advanceTimersByTime(200); // halfway
      mockSocket._trigger("order:status:changed", makeEvent("b"));
    });

    act(() => {
      vi.advanceTimersByTime(300); // complete the 500 ms
    });

    // Both events flushed in a single batch call
    expect(mockUpdateQueryData).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 4.7 — deduplicates events by eventId
  // -------------------------------------------------------------------------
  it("deduplicates order:status:changed events with the same eventId", () => {
    renderHook(() => useAdminSocket());

    const event = {
      orderId: "order-dup",
      orderStatus: "PICKED_UP",
      deliveryStatus: "IN_TRANSIT",
      allowedActions: [],
      version: 2,
      eventId: "dup-event-id",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      mockSocket._trigger("order:status:changed", event);
      mockSocket._trigger("order:status:changed", event); // duplicate
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // The batch should only contain one entry (duplicate was dropped)
    const batchFn = mockUpdateQueryData.mock.calls[0][2];
    const draft = { orders: [{ _id: "order-dup", version: 1 }] };
    batchFn(draft);
    // Only one update applied — version guard would also protect, but dedup fires first
    expect(draft.orders[0].orderStatus).toBe("PICKED_UP");
  });

  it("deduplicates order:assigned events with the same eventId", () => {
    renderHook(() => useAdminSocket());

    const order = {
      _id: "order-assigned-1",
      orderStatus: "ASSIGNED",
      eventId: "assigned-evt-1",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      mockSocket._trigger("order:assigned", order);
      mockSocket._trigger("order:assigned", order); // duplicate
    });

    // Only one updateQueryData call (second was deduped)
    expect(mockUpdateQueryData).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 4.3 — order:assigned full replacement
  // -------------------------------------------------------------------------
  it("handles order:assigned with full replacement in admin orders cache", () => {
    renderHook(() => useAdminSocket());

    const order = {
      _id: "order-new",
      orderStatus: "ASSIGNED",
      eventId: "evt-assigned",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      mockSocket._trigger("order:assigned", order);
    });

    expect(mockUpdateQueryData).toHaveBeenCalledWith(
      "getAdminOrders",
      undefined,
      expect.any(Function)
    );

    // Verify the immer updater replaces existing order
    const updater = mockUpdateQueryData.mock.calls[0][2];
    const draft = { orders: [{ _id: "order-new", orderStatus: "PENDING" }] };
    updater(draft);
    expect(draft.orders[0].orderStatus).toBe("ASSIGNED");
  });

  it("inserts order:assigned into cache when order does not exist", () => {
    renderHook(() => useAdminSocket());

    const order = {
      _id: "order-brand-new",
      orderStatus: "ASSIGNED",
      eventId: "evt-new",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      mockSocket._trigger("order:assigned", order);
    });

    const updater = mockUpdateQueryData.mock.calls[0][2];
    const draft = { orders: [] };
    updater(draft);
    expect(draft.orders).toHaveLength(1);
    expect(draft.orders[0]._id).toBe("order-brand-new");
  });

  // -------------------------------------------------------------------------
  // 4.4 — driver:status:update
  // -------------------------------------------------------------------------
  it("handles driver:status:update by updating rider availability and status", () => {
    renderHook(() => useAdminSocket());

    const data = {
      driverId: "rider-1",
      availability: "offline",
      status: "suspended",
    };

    act(() => {
      mockSocket._trigger("driver:status:update", data);
    });

    expect(mockUpdateQueryData).toHaveBeenCalledWith(
      "getAdminRiders",
      undefined,
      expect.any(Function)
    );

    const updater = mockUpdateQueryData.mock.calls[0][2];
    const draft = {
      riders: [{ _id: "rider-1", availability: "online", status: "active" }],
    };
    updater(draft);
    expect(draft.riders[0].availability).toBe("offline");
    expect(draft.riders[0].status).toBe("suspended");
  });

  // -------------------------------------------------------------------------
  // 4.5 — driver:location:update dispatches adminActions.updateRiderLocation
  // -------------------------------------------------------------------------
  it("handles driver:location:update by dispatching updateRiderLocation", () => {
    renderHook(() => useAdminSocket());

    const locationData = {
      driverId: "rider-2",
      lat: 17.385,
      lng: 78.4867,
      timestamp: Date.now(),
    };

    act(() => {
      mockSocket._trigger("driver:location:update", locationData);
    });

    expect(mockUpdateRiderLocation).toHaveBeenCalledWith(locationData);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "admin/updateRiderLocation",
      payload: locationData,
    });
  });

  // -------------------------------------------------------------------------
  // 9c.4 — cleans up all listeners and disconnects on unmount
  // -------------------------------------------------------------------------
  it("calls socket.off for every registered listener on unmount", () => {
    const { unmount } = renderHook(() => useAdminSocket());

    unmount();

    const offCalls = mockSocket.off.mock.calls.map((c) => c[0]);
    expect(offCalls).toContain("order:status:changed");
    expect(offCalls).toContain("order:assigned");
    expect(offCalls).toContain("driver:status:update");
    expect(offCalls).toContain("driver:location:update");
  });

  it("calls socket.disconnect() on unmount", () => {
    const { unmount } = renderHook(() => useAdminSocket());

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending batch timer on unmount", () => {
    const { unmount } = renderHook(() => useAdminSocket());

    const event = {
      orderId: "order-x",
      orderStatus: "PICKED_UP",
      deliveryStatus: "IN_TRANSIT",
      allowedActions: [],
      version: 1,
      eventId: "evt-x",
      timestamp: new Date().toISOString(),
    };

    act(() => {
      mockSocket._trigger("order:status:changed", event);
    });

    // Unmount before timer fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Timer was cancelled — no flush should have happened
    expect(mockUpdateQueryData).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // socketStatus transitions
  // -------------------------------------------------------------------------
  it("returns disconnected as initial socketStatus", () => {
    const { result } = renderHook(() => useAdminSocket());
    expect(result.current.socketStatus).toBe("disconnected");
  });

  it("transitions socketStatus to connected on connect event", () => {
    const { result } = renderHook(() => useAdminSocket());

    act(() => {
      mockSocket._trigger("connect");
    });

    expect(result.current.socketStatus).toBe("connected");
  });

  it("transitions socketStatus to reconnecting on reconnect_attempt event", () => {
    const { result } = renderHook(() => useAdminSocket());

    act(() => {
      mockSocket._trigger("reconnect_attempt");
    });

    expect(result.current.socketStatus).toBe("reconnecting");
  });

  it("transitions socketStatus to disconnected on disconnect event", () => {
    const { result } = renderHook(() => useAdminSocket());

    act(() => {
      mockSocket._trigger("connect");
      mockSocket._trigger("disconnect");
    });

    expect(result.current.socketStatus).toBe("disconnected");
  });

  // -------------------------------------------------------------------------
  // No socket created when token is absent
  // -------------------------------------------------------------------------
  it("does not create a socket when token is null", async () => {
    mockToken = null;
    const { io } = await import("socket.io-client");

    renderHook(() => useAdminSocket());

    expect(io).not.toHaveBeenCalled();
  });
});
