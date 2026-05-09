import Razorpay from 'razorpay';
import { logger } from './logger';

/**
 * Razorpay Client Utility
 * 
 * Provides a singleton instance of the Razorpay client with proper
 * error handling and credential validation.
 * 
 * Requirements: TR-001
 */

let razorpayInstance: Razorpay | null = null;

/**
 * Get or create Razorpay client instance
 * 
 * @returns Razorpay client instance
 * @throws Error if credentials are missing
 */
export function getRazorpayClient(): Razorpay {
  // Return existing instance if already initialized
  if (razorpayInstance) {
    return razorpayInstance;
  }

  // Validate credentials
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const missingVars = [];
    if (!keyId) missingVars.push('RAZORPAY_KEY_ID');
    if (!keySecret) missingVars.push('RAZORPAY_KEY_SECRET');
    
    const errorMessage = `Missing Razorpay credentials: ${missingVars.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Initialize Razorpay client
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    logger.info('✅ Razorpay client initialized successfully', {
      keyId: keyId.substring(0, 8) + '...',
      environment: keyId.startsWith('rzp_live_') ? 'live' : 'test',
    });

    return razorpayInstance;
  } catch (error) {
    logger.error('Failed to initialize Razorpay client', { error });
    throw new Error('Failed to initialize Razorpay client');
  }
}

/**
 * Reset the Razorpay client instance (useful for testing)
 */
export function resetRazorpayClient(): void {
  razorpayInstance = null;
}

// Export singleton instance getter as default
export default getRazorpayClient;
