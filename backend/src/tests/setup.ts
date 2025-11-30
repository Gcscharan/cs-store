import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true });

let mongoServer: MongoMemoryServer | null = null;

export const connect = async (): Promise<void> => {
  if (mongoServer) {
    // Already initialized
    return;
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Ensure we never accidentally hit the real DB in tests
  process.env.MONGO_URI = uri;

  await mongoose.connect(uri, {
    dbName: 'test-db',
  } as any);
};

export const clear = async (): Promise<void> => {
  if (!mongoose.connection.db) return;

  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
};

export const close = async (): Promise<void> => {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.connection.close().catch(() => undefined);

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

/**
 * Global Jest setup for integration tests.
 * - Starts an in-memory MongoDB instance
 * - Points Mongoose at that instance
 * - Clears all collections between tests
 */
beforeAll(async () => {
  await connect();
});

beforeEach(async () => {
  await clear();
});

afterAll(async () => {
  await close();
});
