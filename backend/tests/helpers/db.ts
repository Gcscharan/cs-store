import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let mongoServer: MongoMemoryReplSet | null = null;

export async function setupTestDB() {
  // Database is already set up in setup-globals.ts
  // This function is kept for compatibility with test files
  return;
}

export async function teardownTestDB() {
  // Cleanup is handled in setup-globals.ts afterAll
  // This function is kept for compatibility with test files
  return;
}

export async function createTestUser(overrides: any = {}) {
  const user = await (global as any).createTestUser(overrides);
  const token = await (global as any).getAuthToken(user);
  return {
    ...user.toObject(),
    id: user._id.toString(),
    token,
  };
}

export async function createTestProduct(overrides: any = {}) {
  return (global as any).createTestProduct(overrides);
}

export async function createTestOrder(userId: string, overrides: any = {}) {
  return (global as any).createTestOrder(userId, overrides);
}

export async function createTestPaidOrder(userId: string, productOverrides: any = {}, orderOverrides: any = {}) {
  return (global as any).createTestPaidOrder(userId, productOverrides, orderOverrides);
}

export async function getAuthToken(user: any) {
  return (global as any).getAuthToken(user);
}
