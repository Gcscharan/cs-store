/**
 * Metrics Service
 * 
 * Core intelligence layer for voice AI system
 * Measures, analyzes, and provides insights
 * 
 * UPGRADES:
 * - TRUE accuracy tracking (isCorrectProduct)
 * - Time window analysis (last 24h, 7d, etc.)
 * - Dimension breakdowns (by type, source, confidence)
 */

import VoiceMetrics from '../models/VoiceMetrics';
import { logger } from '../utils/logger';

/**
 * Get overall voice AI metrics
 * 
 * NOW WITH:
 * - Time windows (default: 24h)
 * - TRUE accuracy (isCorrectProduct)
 * - Dimension breakdowns
 */
export async function getVoiceMetrics(hours: number = 24) {
  try {
    // 🔥 GAP 2 FIX: Time window filter
    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);
    const filter = { timestamp: { $gte: timeWindow } };

    const total = await VoiceMetrics.countDocuments(filter);

    if (total === 0) {
      return {
        total: 0,
        accuracy: 0,
        trueAccuracy: 0,
        correctionRate: 0,
        falseCorrectionRate: 0,
        avgLatency: 0,
        avgQueueDelay: 0,
        timeWindow: `${hours}h`,
      };
    }

    const [
      successCount,
      trueSuccessCount, // 🔥 GAP 1 FIX: TRUE accuracy
      correctedCount,
      falseCorrectionCount,
      latencyStats
    ] = await Promise.all([
      VoiceMetrics.countDocuments({ ...filter, success: true }),
      VoiceMetrics.countDocuments({ ...filter, isCorrectProduct: true }),
      VoiceMetrics.countDocuments({ ...filter, wasCorrected: true }),
      VoiceMetrics.countDocuments({
        ...filter,
        wasCorrected: true,
        isCorrectProduct: false,
      }),
      VoiceMetrics.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            avgLatency: { $avg: '$latency' },
            avgQueueDelay: { $avg: '$queueDelay' },
          },
        },
      ]),
    ]);

    const accuracy = successCount / total;
    const trueAccuracy = trueSuccessCount / total; // 🔥 REAL ACCURACY
    const correctionRate = correctedCount / total;
    const falseCorrectionRate =
      correctedCount > 0 ? falseCorrectionCount / correctedCount : 0;

    return {
      total,
      accuracy: Math.round(accuracy * 100) / 100,
      trueAccuracy: Math.round(trueAccuracy * 100) / 100, // 🔥 NEW
      correctionRate: Math.round(correctionRate * 100) / 100,
      falseCorrectionRate: Math.round(falseCorrectionRate * 100) / 100,
      avgLatency: Math.round(latencyStats[0]?.avgLatency || 0),
      avgQueueDelay: Math.round(latencyStats[0]?.avgQueueDelay || 0),
      timeWindow: `${hours}h`,
    };
  } catch (error: any) {
    logger.error('[MetricsService] getVoiceMetrics error:', error);
    throw error;
  }
}

/**
 * 🔥 GAP 3 FIX: Dimension breakdown by correction type
 * 
 * Tells you WHAT is failing, not just THAT it's failing
 */
export async function getAccuracyByType(hours: number = 24) {
  try {
    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);
    const filter = { timestamp: { $gte: timeWindow } };

    // Breakdown by correction confidence ranges
    const byConfidence = await VoiceMetrics.aggregate([
      { $match: { ...filter, wasCorrected: true } },
      {
        $bucket: {
          groupBy: '$confidence',
          boundaries: [0, 0.5, 0.7, 0.85, 1.0],
          default: 'other',
          output: {
            count: { $sum: 1 },
            trueSuccess: { $sum: { $cond: ['$isCorrectProduct', 1, 0] } },
          },
        },
      },
    ]);

    const confidenceBreakdown = byConfidence.map((bucket) => ({
      range: `${bucket._id}-${bucket._id === 0 ? 0.5 : bucket._id === 0.5 ? 0.7 : bucket._id === 0.7 ? 0.85 : 1.0}`,
      count: bucket.count,
      trueAccuracy: bucket.count > 0 ? Math.round((bucket.trueSuccess / bucket.count) * 100) / 100 : 0,
    }));

    // Breakdown by correction vs no correction
    const [correctedStats, uncorrectedStats] = await Promise.all([
      VoiceMetrics.aggregate([
        { $match: { ...filter, wasCorrected: true } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            trueSuccess: { $sum: { $cond: ['$isCorrectProduct', 1, 0] } },
          },
        },
      ]),
      VoiceMetrics.aggregate([
        { $match: { ...filter, wasCorrected: false } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            trueSuccess: { $sum: { $cond: ['$isCorrectProduct', 1, 0] } },
          },
        },
      ]),
    ]);

    const corrected = correctedStats[0] || { count: 0, trueSuccess: 0 };
    const uncorrected = uncorrectedStats[0] || { count: 0, trueSuccess: 0 };

    return {
      byConfidence: confidenceBreakdown,
      bySource: {
        corrected: {
          count: corrected.count,
          trueAccuracy: corrected.count > 0 ? Math.round((corrected.trueSuccess / corrected.count) * 100) / 100 : 0,
        },
        uncorrected: {
          count: uncorrected.count,
          trueAccuracy: uncorrected.count > 0 ? Math.round((uncorrected.trueSuccess / uncorrected.count) * 100) / 100 : 0,
        },
      },
      timeWindow: `${hours}h`,
    };
  } catch (error: any) {
    logger.error('[MetricsService] getAccuracyByType error:', error);
    throw error;
  }
}

/**
 * Get top failures (queries that fail most often)
 * 
 * THIS IS GOLD - tells you what your system is bad at
 * 
 * NOW WITH: Time window filter
 */
export async function getTopFailures(limit = 10, hours: number = 24) {
  try {
    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const failures = await VoiceMetrics.aggregate([
      { $match: { timestamp: { $gte: timeWindow }, isCorrectProduct: false } },
      {
        $group: {
          _id: '$query',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          wasCorrected: { $first: '$wasCorrected' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return failures.map((f) => ({
      query: f._id,
      failureCount: f.count,
      avgConfidence: Math.round(f.avgConfidence * 100) / 100,
      wasCorrected: f.wasCorrected,
    }));
  } catch (error: any) {
    logger.error('[MetricsService] getTopFailures error:', error);
    throw error;
  }
}

/**
 * Get correction effectiveness
 * 
 * Measures: Are corrections helping or hurting?
 * 
 * NOW WITH: TRUE accuracy (isCorrectProduct)
 */
export async function getCorrectionEffectiveness(hours: number = 24) {
  try {
    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);
    const filter = { timestamp: { $gte: timeWindow } };
    
    const [correctedSuccess, correctedTotal, uncorrectedSuccess, uncorrectedTotal] =
      await Promise.all([
        VoiceMetrics.countDocuments({ ...filter, wasCorrected: true, isCorrectProduct: true }),
        VoiceMetrics.countDocuments({ ...filter, wasCorrected: true }),
        VoiceMetrics.countDocuments({ ...filter, wasCorrected: false, isCorrectProduct: true }),
        VoiceMetrics.countDocuments({ ...filter, wasCorrected: false }),
      ]);

    const correctedSuccessRate =
      correctedTotal > 0 ? correctedSuccess / correctedTotal : 0;
    const uncorrectedSuccessRate =
      uncorrectedTotal > 0 ? uncorrectedSuccess / uncorrectedTotal : 0;

    return {
      correctedSuccessRate: Math.round(correctedSuccessRate * 100) / 100,
      uncorrectedSuccessRate: Math.round(uncorrectedSuccessRate * 100) / 100,
      improvement:
        Math.round((correctedSuccessRate - uncorrectedSuccessRate) * 100) / 100,
      timeWindow: `${hours}h`,
    };
  } catch (error: any) {
    logger.error('[MetricsService] getCorrectionEffectiveness error:', error);
    throw error;
  }
}

/**
 * Get performance metrics over time
 * 
 * NOW WITH: Time window parameter
 */
export async function getPerformanceMetrics(hours = 24) {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await VoiceMetrics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00',
              date: '$timestamp',
            },
          },
          avgLatency: { $avg: '$latency' },
          avgQueueDelay: { $avg: '$queueDelay' },
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: ['$success', 1, 0] },
          },
          trueSuccessCount: {
            $sum: { $cond: ['$isCorrectProduct', 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return metrics.map((m) => ({
      hour: m._id,
      avgLatency: Math.round(m.avgLatency),
      avgQueueDelay: Math.round(m.avgQueueDelay || 0),
      count: m.count,
      successRate: Math.round((m.successCount / m.count) * 100) / 100,
      trueSuccessRate: Math.round((m.trueSuccessCount / m.count) * 100) / 100,
    }));
  } catch (error: any) {
    logger.error('[MetricsService] getPerformanceMetrics error:', error);
    throw error;
  }
}

/**
 * Get dashboard summary (all key metrics)
 * 
 * NOW WITH: Time window support + dimension breakdowns
 */
export async function getDashboardMetrics(hours: number = 24) {
  try {
    const [overall, topFailures, effectiveness, performance, breakdown] = await Promise.all([
      getVoiceMetrics(hours),
      getTopFailures(10, hours),
      getCorrectionEffectiveness(hours),
      getPerformanceMetrics(hours),
      getAccuracyByType(hours),
    ]);

    return {
      overall,
      topFailures,
      effectiveness,
      performance,
      breakdown, // 🔥 NEW: Dimension breakdown
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error('[MetricsService] getDashboardMetrics error:', error);
    throw error;
  }
}

/**
 * Log a voice search metric (called from search flow)
 * 
 * NOW WITH: isCorrectProduct tracking + A/B testing variant
 */
export async function logVoiceSearch(data: {
  query: string;
  correctedTo: string;
  productId?: string;
  correctedProductId?: string; // 🔥 NEW: Expected product from correction
  success: boolean;
  confidence: number;
  latency: number;
  queueDelay?: number;
  userId?: string;
  sessionId?: string;
  variant?: string;            // 🔥 A/B testing variant
  experimentName?: string;     // 🔥 A/B testing experiment
}) {
  try {
    const wasCorrected = data.query.toLowerCase() !== data.correctedTo.toLowerCase();
    
    // 🔥 GAP 1 FIX: Calculate TRUE success
    const isCorrectProduct = data.productId && data.correctedProductId
      ? data.productId === data.correctedProductId
      : data.success; // Fallback to success if no correctedProductId

    await VoiceMetrics.create({
      query: data.query.toLowerCase().trim(),
      correctedTo: data.correctedTo.toLowerCase().trim(),
      productId: data.productId,
      correctedProductId: data.correctedProductId,
      success: data.success,
      isCorrectProduct, // 🔥 NEW
      wasCorrected,
      confidence: data.confidence,
      latency: data.latency,
      queueDelay: data.queueDelay,
      userId: data.userId,
      sessionId: data.sessionId,
      variant: data.variant,           // 🔥 A/B testing
      experimentName: data.experimentName, // 🔥 A/B testing
      timestamp: new Date(),
    });

    logger.info('[MetricsService] Voice search logged:', {
      query: data.query,
      success: data.success,
      isCorrectProduct,
      wasCorrected,
      variant: data.variant,
    });
  } catch (error: any) {
    // Don't fail the request if metrics logging fails
    logger.error('[MetricsService] logVoiceSearch error:', error);
  }
}
