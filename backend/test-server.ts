import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Product } from './src/models/Product';

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/cps-store')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Product routes
app.get('/api/products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const products = await Product.find().limit(limit);
    
    // Transform products to include only thumbnails for list views
    const transformedProducts = products.map((product: any) => ({
      ...product.toObject(),
      images: (product.images || []).map((img: any) => {
        if (typeof img === 'string') return img;
        return img.thumb || img.full || '/placeholder-product.svg';
      })
    }));
    
    res.json({ products: transformedProducts });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log('Raw product:', JSON.stringify(product.toObject(), null, 2));
    
    // Return raw data for now to debug
    res.json({ product: product.toObject() });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
