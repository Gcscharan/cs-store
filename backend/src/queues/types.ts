/**
 * Queue Job Data Types
 * 
 * Defines the structure of jobs in the voice AI queue system
 */

/**
 * Correction Job Data
 * Queued when a user correction needs to be saved
 */
export interface CorrectionJobData {
  wrong: string;           // User's input query
  correct: string;         // Correct product name
  productId: string;       // Product ID
  userId?: string;         // User ID (optional, null for global)
  confidence: number;      // Confidence score (0-1)
  requestId: string;       // Request ID for tracing
  timestamp: number;       // Job creation timestamp
}

/**
 * Click Job Data
 * Queued when a product click needs to be tracked
 */
export interface ClickJobData {
  productId: string;       // Product ID
  productName: string;     // Product name
  userId: string;          // User ID
  query: string;           // Search query
  isVoice: boolean;        // Was this a voice search?
  sessionId?: string;      // Session ID (optional)
  requestId: string;       // Request ID for tracing
  timestamp: number;       // Job creation timestamp
}

/**
 * Sync Job Data
 * Queued when user data needs to be synced
 */
export interface SyncJobData {
  userId: string;                    // User ID
  corrections: any[];                // User corrections to sync
  rankings: any[];                   // User rankings to sync
  requestId: string;                 // Request ID for tracing
  timestamp: number;                 // Job creation timestamp
}

/**
 * Queue Names
 */
export enum QueueName {
  CORRECTIONS = 'voice-corrections',
  CLICKS = 'voice-clicks',
  SYNC = 'voice-sync',
}

/**
 * Job Priority Levels
 */
export enum JobPriority {
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

/**
 * Queue Health Status
 */
export interface QueueHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  queues: {
    [queueName: string]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      workers: number;
    };
  };
  redis: {
    connected: boolean;
    error?: string;
  };
}

/**
 * Queue Metrics
 */
export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  processingRate: number;  // Jobs/sec
  avgProcessingTime: number; // ms
}
