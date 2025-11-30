// backend/worker/imageWorker.js
const Queue = require('bull');
const { dataUrlToBuffer, generateFullAndThumbFromBuffer } = require('../dist/utils/imageUtils');
const Product = require('../dist/models/Product').default;

// Create queue connection
const queue = new Queue('image-processing', {
  redis: {
    port: 6379,
    host: '127.0.0.1',
  },
});

console.log('🖼️  Image Worker started - processing image jobs...');

// Process image generation jobs
queue.process('generate', async (job) => {
  const { productId, images } = job.data;
  
  try {
    console.log(`📸 Processing images for product: ${productId}`);
    
    const processedImages = [];
    
    for (const dataUrl of images) {
      try {
        // Convert data URL to buffer
        const buffer = dataUrlToBuffer(dataUrl);
        
        // Generate full and thumb images
        const { full, thumb } = await generateFullAndThumbFromBuffer(buffer);
        
        processedImages.push({ full, thumb });
        
        console.log(`✅ Processed image for product ${productId}`);
      } catch (error) {
        console.error(`❌ Failed to process image for product ${productId}:`, error);
        // Add placeholder image on failure
        processedImages.push({
          full: '/placeholder-product.svg',
          thumb: '/placeholder-product.svg'
        });
      }
    }
    
    // Update product in database with processed images
    await Product.findByIdAndUpdate(productId, {
      $set: { images: processedImages }
    });
    
    console.log(`✅ Updated product ${productId} with ${processedImages.length} processed images`);
    
    return {
      success: true,
      productId,
      imageCount: processedImages.length,
    };
    
  } catch (error) {
    console.error(`❌ Failed to process images for product ${productId}:`, error);
    throw error;
  }
});

// Error handling
queue.on('error', (err) => {
  console.error('❌ Queue error:', err);
});

queue.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} waiting in queue`);
});

queue.on('active', (job, jobPromise) => {
  console.log(`🔄 Processing job ${job.id}`);
});

queue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed:`, result);
});

queue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

console.log('🖼️  Image Worker ready and waiting for jobs...');
