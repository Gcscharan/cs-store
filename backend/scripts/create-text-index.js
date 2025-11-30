require('dotenv').config();
const mongoose = require('mongoose');

async function createTextIndex() {
  try {
    // Check if MONGODB_URI is available
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    console.log('🔗 Connecting to MongoDB...');
    // Use existing mongoose connection
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const productsCollection = db.collection('products');
    
    // Check if text index already exists
    const indexes = await productsCollection.listIndexes().toArray();
    const existingTextIndex = indexes.find(index => 
      index.name === 'product_text_search' || 
      (index.key && index.key._fts === 'text')
    );
    
    if (existingTextIndex) {
      console.log('🗑️ Dropping existing text index:', existingTextIndex.name);
      await productsCollection.dropIndex(existingTextIndex.name);
      console.log('✅ Existing text index dropped');
    }
    
    // Create text index with weights
    console.log('📝 Creating new text index with proper weights...');
    const result = await productsCollection.createIndex(
      { 
        name: "text", 
        description: "text", 
        tags: "text",
        category: "text"
      }, 
      { 
        weights: { 
          name: 10,        // Highest priority for product names
          description: 2,   // Medium priority for descriptions
          tags: 5,          // High priority for tags
          category: 3       // Medium-high priority for categories
        },
        name: "product_text_search"
      }
    );
    
    console.log('✅ Text index created successfully:', result);
    
    // Verify the index
    const updatedIndexes = await productsCollection.listIndexes().toArray();
    const textIndex = updatedIndexes.find(index => index.name === 'product_text_search');
    
    if (textIndex) {
      console.log('🔍 Text index details:', {
        name: textIndex.name,
        weights: textIndex.weights,
        key: textIndex.key
      });
    }
    
    console.log('📋 All indexes:', updatedIndexes.map(idx => ({ name: idx.name, type: idx.type })));
    
  } catch (error) {
    console.error('❌ Error creating text index:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the script
createTextIndex().catch(console.error);
