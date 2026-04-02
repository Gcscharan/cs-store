/**
 * Experiment Monitor Job
 * 
 * Background job that monitors experiments and:
 * 1. Auto-stops if guardrails violated
 * 2. Auto-deploys winner if detected
 * 
 * Runs every hour
 */

import { logger } from '../utils/logger';
import {
  getAllExperiments,
  autoStopIfGuardrailsViolated,
  autoDeployWinnerIfDetected,
} from '../services/experimentService';

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Monitor all active experiments
 */
async function monitorExperiments() {
  try {
    logger.info('[ExperimentMonitor] Starting experiment monitoring...');
    
    // Get all active experiments
    const experiments = await getAllExperiments();
    const activeExperiments = experiments.filter(exp => exp.isActive);
    
    if (activeExperiments.length === 0) {
      logger.info('[ExperimentMonitor] No active experiments to monitor');
      return;
    }
    
    logger.info(`[ExperimentMonitor] Monitoring ${activeExperiments.length} active experiments`);
    
    for (const experiment of activeExperiments) {
      try {
        // Check guardrails
        const stopResult = await autoStopIfGuardrailsViolated(experiment.name);
        
        if (stopResult.stopped) {
          logger.error(`[ExperimentMonitor] 🚨 AUTO-STOPPED: ${experiment.name}`, {
            reason: stopResult.reason,
            violations: stopResult.violations,
          });
          continue; // Skip winner detection if stopped
        }
        
        // Check for winner
        const deployResult = await autoDeployWinnerIfDetected(experiment.name);
        
        if (deployResult.deployed) {
          logger.info(`[ExperimentMonitor] 🎉 AUTO-DEPLOYED WINNER: ${experiment.name}`, {
            winner: deployResult.winner,
            improvement: deployResult.improvement,
          });
        }
      } catch (error: any) {
        logger.error(`[ExperimentMonitor] Error monitoring experiment ${experiment.name}:`, error);
      }
    }
    
    logger.info('[ExperimentMonitor] Monitoring complete');
  } catch (error: any) {
    logger.error('[ExperimentMonitor] Error in monitoring job:', error);
  }
}

/**
 * Start experiment monitor (runs every hour)
 */
export function startExperimentMonitor() {
  if (monitorInterval) {
    logger.warn('[ExperimentMonitor] Monitor already running');
    return;
  }
  
  logger.info('[ExperimentMonitor] Starting experiment monitor (runs every hour)');
  
  // Run immediately
  monitorExperiments().catch(err => {
    logger.error('[ExperimentMonitor] Initial run failed:', err);
  });
  
  // Then run every hour
  monitorInterval = setInterval(() => {
    monitorExperiments().catch(err => {
      logger.error('[ExperimentMonitor] Scheduled run failed:', err);
    });
  }, 60 * 60 * 1000); // 1 hour
}

/**
 * Stop experiment monitor
 */
export function stopExperimentMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[ExperimentMonitor] Experiment monitor stopped');
  }
}
