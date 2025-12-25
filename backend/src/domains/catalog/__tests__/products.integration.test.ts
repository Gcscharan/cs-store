import express, { Application } from 'express';
import request from 'supertest';

import { connect, clear, close } from '../../../tests/setup';
import productsRoutes from '../routes/products';
import { Product } from '../../../models/Product';

const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());

  // Mount ONLY the catalog/products routes under /api/products
  app.use('/api/products', productsRoutes);

  return app;
};

describe('Catalog Domain - Products Integration', () => {
  let app: Application;
  let product1Id: string;
  let product2Id: string;

  beforeAll(async () => {
    await connect();
    app = createTestApp();
  });

  beforeEach(async () => {
    await clear();

    const product1 = await Product.create({
      name: 'Test Product A',
      description: 'First test product',
      category: 'chocolates',
      price: 100,
      mrp: 120,
      stock: 10,
      weight: 500,
      images: [
        {
          publicId: 'test-a',
          variants: {
            original: 'https://example.com/image-a.jpg',
          },
        },
      ],
      sku: 'TEST-A',
      tags: ['test', 'catalog'],
    });

    const product2 = await Product.create({
      name: 'Test Product B',
      description: 'Second test product',
      category: 'biscuits',
      price: 80,
      mrp: 100,
      stock: 5,
      weight: 300,
      images: [
        {
          publicId: 'test-b',
          variants: {
            original: 'https://example.com/image-b.jpg',
          },
        },
      ],
      sku: 'TEST-B',
      tags: ['test', 'catalog'],
    });

    product1Id = product1._id.toString();
    product2Id = product2._id.toString();
  });

  it('GET /api/products returns the seeded products', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);

    const names = res.body.products.map((p: any) => p.name).sort();
    expect(names).toEqual(['Test Product A', 'Test Product B']);
  });

  it('GET /api/products/:id returns a single product by ID', async () => {
    const res = await request(app).get(`/api/products/${product1Id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('_id', product1Id);
    expect(res.body).toHaveProperty('name', 'Test Product A');
  });
});
