import mongoose from 'mongoose';
import { Product, IProduct } from '../Product';

describe('Product Model - Video Validation', () => {
  afterEach(async () => {
    await Product.deleteMany({});
  });

  describe('Video field is optional', () => {
    it('should create a product without video field (null)', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: null,
      };

      const product = await Product.create(productData);

      expect(product.name).toBe(productData.name);
      expect(product.video).toBeNull();
    });

    it('should create a product without video field (undefined)', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        // video field not provided
      };

      const product = await Product.create(productData);

      expect(product.name).toBe(productData.name);
      expect(product.video).toBeUndefined();
    });

    it('should create a product with complete video metadata', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          hash: 'a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
          duration: 15.5,
        },
      };

      const product = await Product.create(productData);

      expect(product.video).toBeDefined();
      expect(product.video?.url).toBe(productData.video.url);
      expect(product.video?.thumbnail).toBe(productData.video.thumbnail);
      expect(product.video?.publicId).toBe(productData.video.publicId);
      expect(product.video?.hash).toBe(productData.video.hash);
      expect(product.video?.duration).toBe(productData.video.duration);
    });
  });

  describe('Video URL validation', () => {
    it('should reject empty string for video URL', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: '',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should reject whitespace-only string for video URL', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: '   ',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });
  });

  describe('Video thumbnail validation', () => {
    it('should reject empty string for video thumbnail', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: '',
          publicId: 'products/videos/test',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should reject whitespace-only string for video thumbnail', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: '   ',
          publicId: 'products/videos/test',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });
  });

  describe('Video publicId validation', () => {
    it('should reject empty string for video publicId', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: '',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should reject whitespace-only string for video publicId', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: '   ',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });
  });

  describe('Video duration validation', () => {
    it('should reject negative duration', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          duration: -5,
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should reject zero duration', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          duration: 0,
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should accept positive duration', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          duration: 15.5,
        },
      };

      const product = await Product.create(productData);

      expect(product.video?.duration).toBe(15.5);
    });

    it('should allow duration to be omitted', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          // duration not provided
        },
      };

      const product = await Product.create(productData);

      expect(product.video?.duration).toBeUndefined();
    });
  });

  describe('Video hash validation', () => {
    it('should reject empty string for video hash', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          hash: '',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should reject whitespace-only string for video hash', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          hash: '   ',
        },
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    it('should allow hash to be omitted', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          // hash not provided
        },
      };

      const product = await Product.create(productData);

      expect(product.video?.hash).toBeUndefined();
    });

    it('should accept valid hash string', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
          hash: 'a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
        },
      };

      const product = await Product.create(productData);

      expect(product.video?.hash).toBe(productData.video.hash);
    });
  });

  describe('Backward compatibility', () => {
    it('should allow existing products without video field to be queried', async () => {
      // Create a product without video field
      const productData = {
        name: 'Legacy Product',
        description: 'Legacy Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
      };

      const product = await Product.create(productData);
      const foundProduct = await Product.findById(product._id);

      expect(foundProduct).toBeDefined();
      expect(foundProduct?.name).toBe(productData.name);
      expect(foundProduct?.video).toBeUndefined();
    });

    it('should allow existing products without video field to be updated', async () => {
      // Create a product without video field
      const product = await Product.create({
        name: 'Legacy Product',
        description: 'Legacy Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
      });

      // Update the product (without adding video)
      product.price = 150;
      await product.save();

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct?.price).toBe(150);
      expect(updatedProduct?.video).toBeUndefined();
    });

    it('should allow adding video field to existing products', async () => {
      // Create a product without video field
      const product = await Product.create({
        name: 'Legacy Product',
        description: 'Legacy Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
      });

      expect(product.video).toBeUndefined();

      // Add video field
      product.video = {
        url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
        thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
        publicId: 'products/videos/test',
        hash: 'a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
        duration: 15.5,
      };
      await product.save();

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct?.video).toBeDefined();
      expect(updatedProduct?.video?.url).toBe(product.video.url);
    });

    it('should allow removing video field from products', async () => {
      // Create a product with video field
      const product = await Product.create({
        name: 'Product with Video',
        description: 'Description',
        category: 'chocolates',
        price: 100,
        stock: 10,
        weight: 1,
        tags: [],
        video: {
          url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
          thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.jpg',
          publicId: 'products/videos/test',
        },
      });

      expect(product.video).toBeDefined();

      // Remove video field
      product.video = undefined;
      await product.save();

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct?.video).toBeUndefined();
    });
  });
});
