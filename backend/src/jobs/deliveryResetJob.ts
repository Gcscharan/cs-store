/**
 * Delivery Daily Reset Job
 * 
 * Runs at midnight (00:00) every day to reset daily delivery partner metrics:
 * - rejectionsToday → 0
 * 
 * Also cleans stale assignedOrders (orders that are DELIVERED/CANCELLED/FAILED
 * but still in the assignedOrders array — BUG-008 fix).
 * 
 * Schedule: Every day at midnight (checked every 60 seconds)
 */

import { logger } from '../utils/logger';
import { DeliveryBoy } from '../models/DeliveryBoy';
import { Order } from '../models/Order';

let resetInterval: NodeJS.Timeout | null = null;
let lastResetDate: string | null = null;

/**
 * Reset daily rejection counters for all delivery partners
 */
async function resetDailyRejections(): Promise<void> {
  try {
    const result = await DeliveryBoy.updateMany(
      { rejectionsToday: { $gt: 0 } },
      { $set: { rejectionsToday: 0 } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[DeliveryResetJob] ✅ Reset rejectionsToday for ${result.modifiedCount} delivery partners`);
    }
  } catch (error) {
    logger.error('[DeliveryResetJob] ❌ Failed to reset daily rejections:', error);
  }
}

/**
 * Clean stale orders from assignedOrders arrays.
 * Orders that are DELIVERED, CANCELLED, FAILED, or RETURNED should not
 * remain in the assignedOrders array.
 */
async function cleanStaleAssignedOrders(): Promise<void> {
  try {
    // Find delivery boys with non-empty assignedOrders
    const deliveryBoys = await DeliveryBoy.find({
      assignedOrders: { $exists: true, $not: { $size: 0 } },
    }).select('_id assignedOrders currentLoad');

    let totalCleaned = 0;

    for (const boy of deliveryBoys) {
      if (!boy.assignedOrders || boy.assignedOrders.length === 0) continue;

      // Check which orders are in terminal states
      const terminalOrders = await Order.find({
        _id: { $in: boy.assignedOrders },
        orderStatus: { $in: ['DELIVERED', 'delivered', 'CANCELLED', 'cancelled', 'FAILED', 'failed', 'RETURNED', 'returned'] },
      }).select('_id');

      if (terminalOrders.length === 0) continue;

      const terminalIds = terminalOrders.map(o => o._id);

      // Remove terminal orders from assignedOrders and adjust currentLoad
      await DeliveryBoy.updateOne(
        { _id: boy._id },
        {
          $pull: { assignedOrders: { $in: terminalIds } },
          $inc: { currentLoad: -terminalIds.length },
        }
      );

      // Ensure currentLoad doesn't go negative
      await DeliveryBoy.updateOne(
        { _id: boy._id, currentLoad: { $lt: 0 } },
        { $set: { currentLoad: 0 } }
      );

      totalCleaned += terminalIds.length;
    }

    if (totalCleaned > 0) {
      logger.info(`[DeliveryResetJob] ✅ Cleaned ${totalCleaned} stale orders from assignedOrders arrays`);
    }
  } catch (error) {
    logger.error('[DeliveryResetJob] ❌ Failed to clean stale assigned orders:', error);
  }
}

/**
 * Check if it's a new day and run reset if needed
 */
async function checkAndReset(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (lastResetDate === today) return; // Already ran today

  // Run at the start of a new day
  logger.info(`[DeliveryResetJob] 🔄 New day detected (${today}), running daily reset...`);

  await resetDailyRejections();
  await cleanStaleAssignedOrders();

  lastResetDate = today;
  logger.info(`[DeliveryResetJob] ✅ Daily reset complete for ${today}`);
}

/**
 * Start the delivery reset job
 * Checks every 60 seconds if it's a new day
 */
export function startDeliveryResetJob(): void {
  if (resetInterval) {
    logger.warn('[DeliveryResetJob] Job already running');
    return;
  }

  // Run immediately on startup
  checkAndReset().catch(err => {
    logger.error('[DeliveryResetJob] Initial run failed:', err);
  });

  // Check every 60 seconds
  resetInterval = setInterval(() => {
    checkAndReset().catch(err => {
      logger.error('[DeliveryResetJob] Scheduled check failed:', err);
    });
  }, 60 * 1000); // 60 seconds

  logger.info('[DeliveryResetJob] ✅ Scheduled (checks every 60 seconds for new day)');
}

/**
 * Stop the delivery reset job (for graceful shutdown)
 */
export function stopDeliveryResetJob(): void {
  if (resetInterval) {
    clearInterval(resetInterval);
    resetInterval = null;
    logger.info('[DeliveryResetJob] ✅ Stopped');
  }
}
