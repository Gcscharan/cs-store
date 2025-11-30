import { jest } from "@jest/globals";

// Mock Redis client
export const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  exists: jest.fn().mockResolvedValue(false),
  zAdd: jest.fn().mockResolvedValue(1),
  zRange: jest.fn().mockResolvedValue([]),
  zRem: jest.fn().mockResolvedValue(1),
  zCard: jest.fn().mockResolvedValue(0),
  hGet: jest.fn().mockResolvedValue(null),
  hSet: jest.fn().mockResolvedValue(true),
  hGetAll: jest.fn().mockResolvedValue({}),
  hDel: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  incrBy: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(true),
  ttl: jest.fn().mockResolvedValue(-1),
  flushAll: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  quit: jest.fn().mockResolvedValue(true),
  isOpen: true,
  isReady: true,
};

// Mock Redis createClient
export const mockCreateClient = jest.fn(() => mockRedisClient);

// Helper functions for test setup
export function mockRedisGet(key: string, value: string) {
  mockRedisClient.get.mockResolvedValueOnce(value);
}

export function mockRedisSet(key: string, value: string) {
  mockRedisClient.set.mockResolvedValueOnce(true);
}

export function mockRedisExists(key: string, exists: boolean) {
  mockRedisClient.exists.mockResolvedValueOnce(exists);
}

export function mockRedisZRange(key: string, values: any[]) {
  mockRedisClient.zRange.mockResolvedValueOnce(values);
}

export function mockRedisHGet(key: string, field: string, value: string) {
  mockRedisClient.hGet.mockResolvedValueOnce(value);
}

export function mockRedisHGetAll(key: string, hash: Record<string, string>) {
  mockRedisClient.hGetAll.mockResolvedValueOnce(hash);
}

export function clearAllMocks() {
  mockRedisClient.get.mockClear();
  mockRedisClient.set.mockClear();
  mockRedisClient.del.mockClear();
  mockRedisClient.exists.mockClear();
  mockRedisClient.zAdd.mockClear();
  mockRedisClient.zRange.mockClear();
  mockRedisClient.zRem.mockClear();
  mockRedisClient.hGet.mockClear();
  mockRedisClient.hSet.mockClear();
  mockRedisClient.hGetAll.mockClear();
  mockRedisClient.hDel.mockClear();
  mockRedisClient.incr.mockClear();
  mockRedisClient.incrBy.mockClear();
  mockRedisClient.expire.mockClear();
  mockRedisClient.ttl.mockClear();
}
