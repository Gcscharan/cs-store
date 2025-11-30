require('dotenv').config();
import { SearchService } from '../src/services/searchService';
import { Product } from '../src/models/Product';

async function reindexAlgolia() {
  try {
    console.log('🔄 Starting Algolia reindex process...');
    
    // Check if Algolia is configured
    const searchService = new SearchService();
    
    if (!process.env.SEARCH_USE_ALGOLIA || process.env.SEARCH_USE_ALGOLIA === 'false') {
      console.log('ℹ️ Algolia is disabled. Set SEARCH_USE_ALGOLIA=true to enable.');
      process.exit(0);
    }
    
    if (!process.env.ALGOLIA_APP_ID || !process.env.ALGOLIA_ADMIN_API_KEY || !process.env.ALGOLIA_INDEX_NAME) {
      console.log('❌ Algolia configuration missing. Please set:');
      console.log('- ALGOLIA_APP_ID');
      console.log('- ALGOLIA_ADMIN_API_KEY');
      console.log('- ALGOLIA_INDEX_NAME');
      process.exit(1);
    }
    
    // Initialize Algolia index if needed
    console.log('🔧 Initializing Algolia index...');
    await searchService.initializeAlgoliaIndex();
    
    // Load all products from MongoDB
    console.log('📦 Loading products from MongoDB...');
    const products = await Product.find().lean().exec();
    
    if (products.length === 0) {
      console.log('ℹ️ No products found in MongoDB. Nothing to index.');
      process.exit(0);
    }
    
    console.log(`✅ Found ${products.length} products to index`);
    
    // Show progress
    let indexedCount = 0;
    const batchSize = 100;
    const totalBatches = Math.ceil(products.length / batchSize);
    
    // Process in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`📤 Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)...`);
      
      try {
        // Use the reindex method which handles bulk operations
        await searchService.reindexAllProducts();
        indexedCount = products.length; // All products indexed at once
        break; // Exit after first successful bulk operation
      } catch (error) {
        console.error(`❌ Failed to index batch ${batchNumber}:`, error);
        
        // Try individual indexing as fallback
        console.log('🔄 Falling back to individual indexing...');
        for (const product of batch) {
          try {
            await searchService.indexProduct(product);
            indexedCount++;
          } catch (individualError) {
            console.error(`❌ Failed to index product ${product._id}:`, individualError);
          }
        }
      }
    }
    
    console.log(`✅ Reindex completed! ${indexedCount}/${products.length} products indexed`);
    
    // Show sample of indexed products
    console.log('📋 Sample of indexed products:');
    for (let i = 0; i < Math.min(5, products.length); i++) {
      const product = products[i];
      console.log(`  - ${product.name} (${product._id}) - ${product.category} - ₹${product.price}`);
    }
    
    if (products.length > 5) {
      console.log(`  ... and ${products.length - 5} more products`);
    }
    
    console.log('🎉 Algolia reindex completed successfully!');
    
  } catch (error) {
    console.error('❌ Reindex failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the reindex
reindexAlgolia().catch(console.error);
