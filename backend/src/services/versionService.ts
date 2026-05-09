import mongoose from 'mongoose';
import { ProductVersion, IProductVersion } from '../models/ProductVersion';
import { Product } from '../models/Product';
import logger from '../utils/logger';

// Helper: Check if two values are equal (normalized)
function isEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Helper: Calculate diff between two snapshots
function calculateDiff(current: any, target: any): string[] {
  const changed: string[] = [];
  
  for (const key of Object.keys(target)) {
    if (!isEqual(current[key], target[key])) {
      changed.push(key);
    }
  }
  
  return changed;
}

// Helper: Extract snapshot from product
function extractSnapshot(product: any): any {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    pricePerUnit: product.pricePerUnit,
    mrp: product.mrp,
    stock: product.stock,
    weight: product.weight,
    tags: Array.isArray(product.tags) 
      ? product.tags.join(',') 
      : (product.tags || ''),
    status: product.status || 'draft',
    images: Array.isArray(product.images) 
      ? product.images.map((img: any) => {
          if (typeof img === 'string') return img;
          if (img?.variants?.original) return img.variants.original;
          if (img?.url) return img.url;
          return '';
        }).filter((url: string) => url.length > 0)
      : [],
  };
}

/**
 * Create a new version for a product
 * Includes retry logic for race condition protection (FIX 1)
 */
async function createVersion(
  productId: string,
  snapshot: any,
  changedFields: string[],
  actionType: 'update' | 'publish' | 'rollback',
  userId: string,
  options: { session?: mongoose.ClientSession } = {}
): Promise<IProductVersion> {
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const lastVersion = await ProductVersion
        .findOne({ productId })
        .sort({ version: -1 })
        .select('version')
        .session(options.session || null);
      
      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;
      
      const version = await ProductVersion.create([{
        productId,
        version: nextVersion,
        snapshot,
        changedFields,
        actionType,
        updatedBy: userId,
        archived: false,
      }], options.session ? { session: options.session } : {});
      
      logger.info('Version created', {
        productId,
        version: nextVersion,
        actionType,
        changedFields,
      });
      
      // Fire-and-forget archival (async, non-blocking)
      archiveOldVersions(productId).catch(err => {
        logger.error('Archival failed (non-blocking)', {
          productId,
          error: err.message,
        });
      });
      
      return version[0];
    } catch (error: any) {
      // Retry on duplicate key error (race condition)
      if (error.code === 11000 && attempt < maxRetries - 1) {
        logger.warn('Version conflict, retrying...', {
          productId,
          attempt: attempt + 1,
          maxRetries,
        });
        continue;
      }
      
      logger.error('Version creation failed', {
        productId,
        actionType,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  throw new Error('Failed to create version after retries');
}

/**
 * Archive old versions beyond retention limit (50)
 * Deterministic archival based on version number (FIX 2)
 */
async function archiveOldVersions(productId: string): Promise<number> {
  const latest = await ProductVersion.findOne({ productId, archived: false })
    .sort({ version: -1 })
    .select('version');
  
  if (!latest) return 0;
  
  const cutoff = latest.version - 49;
  if (cutoff <= 0) return 0;
  
  const result = await ProductVersion.updateMany(
    {
      productId,
      version: { $lt: cutoff },
      archived: false,
    },
    { $set: { archived: true } }
  );
  
  if (result.modifiedCount > 0) {
    logger.info('Archived old versions', {
      productId,
      count: result.modifiedCount,
      cutoffVersion: cutoff,
      latestVersion: latest.version,
    });
  }
  
  return result.modifiedCount;
}

/**
 * Get paginated version history for a product
 */
async function getVersionHistory(productId: string, page = 1, limit = 20) {
  const query = { productId, archived: false };
  
  const total = await ProductVersion.countDocuments(query);
  
  const versions = await ProductVersion.find(
    query,
    { version: 1, createdAt: 1, updatedBy: 1, actionType: 1, changedFields: 1 }
  )
    .sort({ version: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  
  return {
    versions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a specific version by version number
 */
async function getVersion(productId: string, version: number) {
  return ProductVersion.findOne({ productId, version });
}

/**
 * Generate a field-level diff between two snapshots
 * Returns: { field: { from: oldValue, to: newValue } }
 */
function generateDiff(oldSnapshot: any, newSnapshot: any): Record<string, { from: any; to: any }> {
  const diff: Record<string, { from: any; to: any }> = {};

  const allKeys = new Set([
    ...Object.keys(oldSnapshot || {}),
    ...Object.keys(newSnapshot || {}),
  ]);

  for (const key of allKeys) {
    if (!isEqual(oldSnapshot?.[key], newSnapshot?.[key])) {
      diff[key] = {
        from: oldSnapshot?.[key] ?? null,
        to: newSnapshot?.[key] ?? null,
      };
    }
  }

  return diff;
}

/**
 * Get diff between two versions of a product
 */
async function getVersionDiff(productId: string, v1: number, v2: number) {
  const [version1, version2] = await Promise.all([
    ProductVersion.findOne({ productId, version: v1 }),
    ProductVersion.findOne({ productId, version: v2 }),
  ]);

  if (!version1) throw new Error(`Version ${v1} not found`);
  if (!version2) throw new Error(`Version ${v2} not found`);

  const diff = generateDiff(version1.snapshot, version2.snapshot);

  return {
    productId,
    from: {
      version: version1.version,
      actionType: version1.actionType,
      updatedBy: version1.updatedBy,
      createdAt: version1.createdAt,
    },
    to: {
      version: version2.version,
      actionType: version2.actionType,
      updatedBy: version2.updatedBy,
      createdAt: version2.createdAt,
    },
    diff,
    changedFields: Object.keys(diff),
  };
}

/**
 * Rollback product to a specific version
 * Atomic operation with transaction (FIX 5)
 */
async function rollbackToVersion(
  productId: string,
  targetVersion: number,
  userId: string
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error('Product not found');
    
    const target = await ProductVersion.findOne({
      productId,
      version: targetVersion,
    }).session(session);
    
    if (!target) throw new Error('Version not found');
    
    // Extract current state BEFORE rollback (FIX 5)
    const currentState = extractSnapshot(product);
    const targetState = target.snapshot;
    
    // Calculate diff (what will change in rollback)
    const changedFields = calculateDiff(currentState, targetState);
    
    // Update product with target snapshot
    await Product.findByIdAndUpdate(productId, targetState, { session });
    
    // Create rollback version (with correct changedFields)
    await createVersion(
      productId,
      targetState,
      changedFields,
      'rollback',
      userId,
      { session }
    );
    
    await session.commitTransaction();
    
    logger.info('Rollback completed', {
      productId,
      targetVersion,
      changedFields,
    });
    
    return targetState;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Rollback failed', {
      productId,
      targetVersion,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    session.endSession();
  }
}

export const versionService = {
  createVersion,
  getVersionHistory,
  getVersion,
  getVersionDiff,
  rollbackToVersion,
  archiveOldVersions,
  extractSnapshot,
  calculateDiff,
  generateDiff,
};
