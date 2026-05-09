import { logger } from '../utils/logger';
import { connectDB } from '../utils/database';
import { initializeReviewsDatabase } from '../scripts/initializeReviewsDatabase';

/**
 * Database Configuration and Initialization
 * 
 * This module handles the complete database setup including:
 * - MongoDB connection
 * - Schema initialization
 * - Index creation
 * - Performance optimization
 */

export interface DatabaseConfig {
  autoInitialize?: boolean;
  skipIndexCreation?: boolean;
}

/**
 * Initialize the complete database system
 */
export async function initializeDatabase(config: DatabaseConfig = {}): Promise<void> {
  const { autoInitialize = true, skipIndexCreation = false } = config;
  
  try {
    logger.info('🗄️ Initializing database system...');
    
    // 1. Establish MongoDB connection
    await connectDB();
    logger.info('✅ MongoDB connection established');
    
    // 2. Initialize reviews database schema and indexes (if enabled)
    if (autoInitialize && !skipIndexCreation) {
      await initializeReviewsDatabase();
      logger.info('✅ Reviews database schema initialized');
    }
    
    logger.info('🎉 Database system initialization completed');
    
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get database connection status
 */
export function getDatabaseStatus() {
  const mongoose = require('mongoose');
  
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections) : []
  };
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(): boolean {
  const requiredEnvVars = ['MONGODB_URI'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`❌ Missing required environment variable: ${envVar}`);
      return false;
    }
  }
  
  return true;
}