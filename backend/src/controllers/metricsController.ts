/**
 * Metrics Controller
 * 
 * API endpoints for system intelligence
 * 
 * NOW WITH: Time window support (hours parameter)
 */

import { Request, Response } from 'express';
import {
  getVoiceMetrics,
  getTopFailures,
  getCorrectionEffectiveness,
  getPerformanceMetrics,
  getDashboardMetrics,
  getAccuracyByType,
} from '../services/metricsService';

/**
 * GET /api/metrics/voice?hours=24
 * 
 * Get overall voice AI metrics
 * Query params: hours (default: 24)
 */
export const getVoiceMetricsController = async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await getVoiceMetrics(hours);
    res.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/metrics/voice/failures?limit=10&hours=24
 * 
 * Get top failing queries
 * Query params: limit (default: 10), hours (default: 24)
 */
export const getTopFailuresController = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const hours = parseInt(req.query.hours as string) || 24;
    const failures = await getTopFailures(limit, hours);
    
    res.json({
      success: true,
      failures,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/metrics/voice/effectiveness?hours=24
 * 
 * Get correction effectiveness
 * Query params: hours (default: 24)
 */
export const getCorrectionEffectivenessController = async (
  req: Request,
  res: Response
) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const effectiveness = await getCorrectionEffectiveness(hours);
    
    res.json({
      success: true,
      effectiveness,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/metrics/voice/performance?hours=24
 * 
 * Get performance metrics over time
 * Query params: hours (default: 24)
 */
export const getPerformanceMetricsController = async (
  req: Request,
  res: Response
) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const performance = await getPerformanceMetrics(hours);
    
    res.json({
      success: true,
      performance,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/metrics/voice/breakdown?hours=24
 * 
 * Get accuracy breakdown by dimensions
 * Query params: hours (default: 24)
 */
export const getAccuracyBreakdownController = async (
  req: Request,
  res: Response
) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const breakdown = await getAccuracyByType(hours);
    
    res.json({
      success: true,
      breakdown,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /api/metrics/dashboard?hours=24
 * 
 * Get all dashboard metrics (comprehensive)
 * Query params: hours (default: 24)
 */
export const getDashboardMetricsController = async (
  req: Request,
  res: Response
) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const dashboard = await getDashboardMetrics(hours);
    
    res.json({
      success: true,
      dashboard,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
