import express, { Application } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import authRoutes from '../routes/auth';
import { User } from '../../../models/User';

// NOTE: Global MongoDB lifecycle is managed by src/tests/setup.ts via Jest's setupFilesAfterEnv.

const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());

  // Mount ONLY the Identity/auth routes under /api/auth
  app.use('/api/auth', authRoutes);

  return app;
};

describe('Identity Domain - Auth Integration', () => {
  let app: Application;

  beforeAll(() => {
    app = createTestApp();
  });

  afterAll(async () => {
    // Ensure all models are cleared from Mongoose to avoid Jest open handle warnings
    await mongoose.connection.dropDatabase().catch(() => undefined);
  });

  describe('POST /api/auth/signup', () => {
    it('registers a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          phone: '9999999999',
          password: 'StrongPass@123',
          pincode: '500001',
        });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      const userInDb = await User.findOne({ email: 'test@example.com' });
      expect(userInDb).not.toBeNull();
    });

    it('rejects duplicate registration with same email', async () => {
      // Seed initial user directly via model
      await User.create({
        name: 'Existing User',
        email: 'duplicate@example.com',
        phone: '8888888888',
        password: 'HashedPassword',
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'New User',
          email: 'duplicate@example.com',
          phone: '7777777777',
          password: 'StrongPass@123',
          pincode: '500001',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
