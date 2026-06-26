/**
 * Tests for the Socket.IO Redis adapter wiring.
 *
 * The critical behavior: attachSocketRedisAdapter must NEVER crash startup. It
 * either attaches the adapter (multi-instance real-time) or falls back to
 * single-instance mode. We assert the control-flow / fallback contract here
 * (a true cross-instance pub/sub test requires a live Redis + two io servers and
 * lives in the integration suite).
 */

// Mock the redis base client (duplicate() returns connectable fakes).
const makeFakeClient = () => ({
  isOpen: false,
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
});

const mockDuplicate = jest.fn();
jest.mock("../../../src/config/redis", () => ({
  redis: {
    duplicate: (...a: any[]) => mockDuplicate(...a),
  },
}));

const mockCreateAdapter = jest.fn(() => "ADAPTER_FN");
jest.mock("@socket.io/redis-adapter", () => ({
  createAdapter: (...a: any[]) => mockCreateAdapter(...a),
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { attachSocketRedisAdapter } from "../../../src/config/socketRedisAdapter";

function makeIo() {
  return { adapter: jest.fn() } as any;
}

describe("attachSocketRedisAdapter", () => {
  const prevEnv = process.env.SOCKET_REDIS_ADAPTER_ENABLED;
  const prevNode = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDuplicate.mockImplementation(() => makeFakeClient());
  });

  afterEach(() => {
    process.env.SOCKET_REDIS_ADAPTER_ENABLED = prevEnv;
    process.env.NODE_ENV = prevNode;
  });

  test("attaches adapter when enabled and Redis connects", async () => {
    process.env.SOCKET_REDIS_ADAPTER_ENABLED = "true";
    const io = makeIo();

    const result = await attachSocketRedisAdapter(io);

    expect(result).toBe(true);
    // Two duplicated clients (pub + sub)
    expect(mockDuplicate).toHaveBeenCalledTimes(2);
    expect(mockCreateAdapter).toHaveBeenCalled();
    expect(io.adapter).toHaveBeenCalledWith("ADAPTER_FN");
  });

  test("skips (single-instance) when explicitly disabled", async () => {
    process.env.SOCKET_REDIS_ADAPTER_ENABLED = "false";
    const io = makeIo();

    const result = await attachSocketRedisAdapter(io);

    expect(result).toBe(false);
    expect(io.adapter).not.toHaveBeenCalled();
    expect(mockDuplicate).not.toHaveBeenCalled();
  });

  test("skips in test env by default (no flag)", async () => {
    delete process.env.SOCKET_REDIS_ADAPTER_ENABLED;
    process.env.NODE_ENV = "test";
    const io = makeIo();

    const result = await attachSocketRedisAdapter(io);

    expect(result).toBe(false);
    expect(io.adapter).not.toHaveBeenCalled();
  });

  test("falls back gracefully (no throw) when Redis connect fails", async () => {
    process.env.SOCKET_REDIS_ADAPTER_ENABLED = "true";
    mockDuplicate.mockImplementation(() => ({
      isOpen: false,
      connect: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      on: jest.fn(),
    }));
    const io = makeIo();

    const result = await attachSocketRedisAdapter(io);

    // Must NOT throw, and must report fallback.
    expect(result).toBe(false);
    expect(io.adapter).not.toHaveBeenCalled();
  });
});
