import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { versionService } from '../services/versionService';
import { invalidateCache } from '../middleware/cache';
import logger from '../utils/logger';
import mongoose from 'mongoose';

/**
 * GET /admin/products/:id/versions
 * Get paginated version history for a product
 */
export const getVersionHistory = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    logger.info('📜 [GetVersionHistory] Request received:', {
      productId: id,
      page,
      limit,
    });

    // Validate product ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Parse pagination params with safety limits
    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Number(limit) || 20, 100); // Cap at 100 to prevent DB load spike

    // Get version history
    const result = await versionService.getVersionHistory(
      id,
      parsedPage,
      parsedLimit
    );

    logger.info('✅ [GetVersionHistory] Success:', {
      productId: id,
      versionsCount: result.versions.length,
      total: result.pagination.total,
    });

    res.json(result);
  } catch (error) {
    logger.error('❌ [GetVersionHistory] Error:', error);
    const err = error as any;
    res.status(500).json({
      message: 'Failed to fetch version history',
      error: err?.message || String(err),
    });
  }
};

/**
 * GET /admin/products/:id/versions/:version
 * Get a specific version snapshot
 */
export const getVersion = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id, version } = req.params;

    logger.info('📄 [GetVersion] Request received:', {
      productId: id,
      version,
    });

    // Validate product ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Validate version number (strict integer check to prevent NaN bugs)
    const versionNumber = Number(version);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ message: 'Invalid version number' });
    }

    // Get version
    const versionDoc = await versionService.getVersion(id, versionNumber);

    if (!versionDoc) {
      logger.info('❌ [GetVersion] Version not found:', {
        productId: id,
        version: versionNumber,
      });
      return res.status(404).json({ message: 'Version not found' });
    }

    logger.info('✅ [GetVersion] Success:', {
      productId: id,
      version: versionNumber,
    });

    res.json(versionDoc);
  } catch (error) {
    logger.error('❌ [GetVersion] Error:', error);
    const err = error as any;
    res.status(500).json({
      message: 'Failed to fetch version',
      error: err?.message || String(err),
    });
  }
};

/**
 * GET /admin/products/:id/versions/:v1/diff/:v2
 * Get field-level diff between two versions
 */
export const getVersionDiff = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id, v1, v2 } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const v1Num = Number(v1);
    const v2Num = Number(v2);

    if (!Number.isInteger(v1Num) || v1Num < 1) {
      return res.status(400).json({ message: 'Invalid version number for v1' });
    }
    if (!Number.isInteger(v2Num) || v2Num < 1) {
      return res.status(400).json({ message: 'Invalid version number for v2' });
    }
    if (v1Num === v2Num) {
      return res.status(400).json({ message: 'v1 and v2 must be different versions' });
    }

    const result = await versionService.getVersionDiff(id, v1Num, v2Num);

    res.json(result);
  } catch (error) {
    const err = error as any;
    if (err?.message?.includes('not found')) {
      return res.status(404).json({ message: err.message });
    }
    logger.error('❌ [GetVersionDiff] Error:', error);
    res.status(500).json({ message: 'Failed to compute diff', error: err?.message });
  }
};
export const rollbackProduct = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id, version } = req.params;
    const userId = req.user?._id;

    logger.info('⏪ [RollbackProduct] Request received:', {
      productId: id,
      targetVersion: version,
      userId,
    });

    // Validate product ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Validate version number (strict integer check to prevent NaN bugs)
    const versionNumber = Number(version);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ message: 'Invalid version number' });
    }

    // Validate user ID
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Perform rollback (atomic operation with transaction)
    const restoredSnapshot = await versionService.rollbackToVersion(
      id,
      versionNumber,
      userId.toString()
    );

    logger.info('✅ [RollbackProduct] Rollback successful:', {
      productId: id,
      targetVersion: versionNumber,
    });

    // Invalidate cache
    await invalidateCache.product(id);

    res.json({
      success: true,
      message: `Product rolled back to version ${versionNumber}`,
      snapshot: restoredSnapshot,
    });
  } catch (error) {
    logger.error('❌ [RollbackProduct] Error:', error);
    const err = error as any;

    // Handle specific error cases
    if (err?.message === 'Product not found') {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (err?.message === 'Version not found') {
      return res.status(404).json({ message: 'Version not found' });
    }

    res.status(500).json({
      message: 'Rollback failed',
      error: err?.message || String(err),
    });
  }
};
