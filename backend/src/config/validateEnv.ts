/**
 * Environment Variable Validation
 * 
 * CRITICAL: This file validates all required environment variables at startup.
 * If any required variable is missing or invalid, the application will NOT start.
 * 
 * This prevents production deployments with missing/invalid configuration.
 */

interface RequiredEnvVars {
  // Database
  MONGODB_URI: string;
  
  // JWT Authentication
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  
  // Payment Gateway (Razorpay)
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  
  // Email Services
  RESEND_API_KEY: string;
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  
  // Google Maps
  GOOGLE_MAPS_API_KEY: string;
  
  // Cloudinary (Image Storage)
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  
  // Bull Board (Job Queue Dashboard)
  BULL_BOARD_ADMIN_SECRET: string;
  
  // Node Environment
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * Validates all required environment variables
 * Throws error and exits if validation fails
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🔍 Validating environment variables...\n');
  
  // ============================================
  // REQUIRED VARIABLES
  // ============================================
  
  const required: (keyof RequiredEnvVars)[] = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD',
    'GOOGLE_MAPS_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'BULL_BOARD_ADMIN_SECRET',
    'NODE_ENV',
  ];
  
  // Check if variables are set
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`❌ ${key} is required but not set`);
    }
  }
  
  // ============================================
  // VALIDATION RULES
  // ============================================
  
  // JWT_SECRET validation
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      errors.push(`❌ JWT_SECRET must be at least 32 characters (current: ${process.env.JWT_SECRET.length})`);
    }
    if (process.env.JWT_SECRET === 'your-secret-key' || 
        process.env.JWT_SECRET === 'your-super-secret-jwt-key-here') {
      errors.push(`❌ JWT_SECRET is using default/example value - MUST be changed`);
    }
  }
  
  // JWT_REFRESH_SECRET validation
  if (process.env.JWT_REFRESH_SECRET) {
    if (process.env.JWT_REFRESH_SECRET.length < 32) {
      errors.push(`❌ JWT_REFRESH_SECRET must be at least 32 characters`);
    }
    if (process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
      errors.push(`❌ JWT_REFRESH_SECRET must be different from JWT_SECRET`);
    }
  }
  
  // NODE_ENV validation
  if (process.env.NODE_ENV) {
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(process.env.NODE_ENV)) {
      errors.push(`❌ NODE_ENV must be one of: ${validEnvs.join(', ')} (current: ${process.env.NODE_ENV})`);
    }
  }
  
  // Razorpay validation
  if (process.env.RAZORPAY_KEY_ID) {
    if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_')) {
      errors.push(`❌ RAZORPAY_KEY_ID must start with 'rzp_' (current: ${process.env.RAZORPAY_KEY_ID.substring(0, 10)}...)`);
    }
    // Check for test credentials in production
    if (process.env.NODE_ENV === 'production' && process.env.RAZORPAY_KEY_ID.includes('test')) {
      errors.push(`❌ RAZORPAY_KEY_ID appears to be a test key but NODE_ENV is production`);
    }
  }
  
  // Resend API Key validation
  if (process.env.RESEND_API_KEY) {
    if (!process.env.RESEND_API_KEY.startsWith('re_')) {
      errors.push(`❌ RESEND_API_KEY must start with 're_'`);
    }
    // Check for exposed key
    if (process.env.RESEND_API_KEY === 're_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx') {
      errors.push(`❌ RESEND_API_KEY is using EXPOSED key from code - MUST be changed immediately`);
    }
  }
  
  // Gmail validation
  if (process.env.GMAIL_APP_PASSWORD) {
    // Check for exposed password
    if (process.env.GMAIL_APP_PASSWORD === 'lnjhscqyipztkvyu') {
      errors.push(`❌ GMAIL_APP_PASSWORD is using EXPOSED password from code - MUST be changed immediately`);
    }
  }
  
  // MongoDB URI validation
  if (process.env.MONGODB_URI) {
    if (!process.env.MONGODB_URI.startsWith('mongodb://') && 
        !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
      errors.push(`❌ MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'`);
    }
  }
  
  // Bull Board Admin Secret validation
  if (process.env.BULL_BOARD_ADMIN_SECRET) {
    if (process.env.BULL_BOARD_ADMIN_SECRET === 'admin-secret-change-in-production') {
      errors.push(`❌ BULL_BOARD_ADMIN_SECRET is using default value - MUST be changed`);
    }
    if (process.env.BULL_BOARD_ADMIN_SECRET.length < 16) {
      errors.push(`❌ BULL_BOARD_ADMIN_SECRET must be at least 16 characters (current: ${process.env.BULL_BOARD_ADMIN_SECRET.length})`);
    }
  }
  
  // ============================================
  // PRODUCTION-SPECIFIC CHECKS
  // ============================================
  
  if (process.env.NODE_ENV === 'production') {
    // Ensure no test/dev values in production
    if (process.env.JWT_SECRET?.includes('test') || process.env.JWT_SECRET?.includes('dev')) {
      warnings.push(`⚠️  JWT_SECRET contains 'test' or 'dev' - ensure this is intentional for production`);
    }
    
    // Ensure HTTPS in production
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb://localhost')) {
      warnings.push(`⚠️  MONGODB_URI points to localhost - ensure this is correct for production`);
    }
  }
  
  // ============================================
  // REPORT RESULTS
  // ============================================
  
  if (errors.length > 0) {
    console.error('\n🔴 ENVIRONMENT VALIDATION FAILED:\n');
    console.error('=' .repeat(80));
    errors.forEach(err => console.error(err));
    console.error('=' .repeat(80));
    console.error('\n💡 Fix these issues before starting the application:');
    console.error('   1. Check your .env file');
    console.error('   2. Ensure all required variables are set');
    console.error('   3. Verify variable formats and values');
    console.error('   4. Never use default/example values in production\n');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('\n⚠️  ENVIRONMENT WARNINGS:\n');
    warnings.forEach(warn => console.warn(warn));
    console.warn('');
  }
  
  console.log('✅ Environment validation passed');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   Database: ${maskUri(process.env.MONGODB_URI!)}`);
  console.log('');
}

/**
 * Masks sensitive parts of MongoDB URI for logging
 */
function maskUri(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    return '[invalid URI]';
  }
}

/**
 * Generate a secure random secret (for documentation/setup)
 */
export function generateSecureSecret(length: number = 64): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('base64');
}
