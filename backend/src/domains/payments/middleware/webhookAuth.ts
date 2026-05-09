import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../../../utils/logger';

/**
 * Middleware to verify Razorpay webhook signature
 * 
 * Verifies the X-Razorpay-Signature header using HMAC SHA256
 * with the webhook secret to ensure the webhook is authentic.
 * 
 * Requirements: TR-004, NFR-003
 * 
 * @param req - Express request object (expects raw body as Buffer)
 * @param res - Express response object
 * @param next - Express next function
 * @returns 401 if signature is invalid, otherwise calls next()
 */
export const verifyRazorpaySignature = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // Get signature from header (case-insensitive)
    const signatureHeader =
      (req.headers['x-razorpay-signature'] as string) ||
      (req.headers['X-Razorpay-Signature'] as string) ||
      '';

    const signature = String(signatureHeader || '').trim();

    if (!signature) {
      logger.warn('[Webhook Auth] Missing X-Razorpay-Signature header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing webhook signature',
      });
    }

    // Get webhook secret from environment
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('[Webhook Auth] RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        error: 'Server misconfigured',
        message: 'Webhook verification not configured',
      });
    }

    // Get raw body (must be Buffer for signature verification)
    const rawBody = (req as any).body as Buffer;

    if (!Buffer.isBuffer(rawBody)) {
      logger.error('[Webhook Auth] Request body is not a Buffer');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid webhook payload format',
      });
    }

    // Compute expected signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSignature);
    const receivedBuf = Buffer.from(signature);

    // Check length first (timing-safe comparison requires equal length)
    if (expectedBuf.length !== receivedBuf.length) {
      logger.warn('[Webhook Auth] Invalid signature - length mismatch', {
        expectedLength: expectedBuf.length,
        receivedLength: receivedBuf.length,
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!isValid) {
      logger.warn('[Webhook Auth] Invalid signature - comparison failed');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }

    // Signature is valid, proceed to next middleware
    logger.info('[Webhook Auth] Signature verified successfully');
    next();
  } catch (error) {
    logger.error('[Webhook Auth] Signature verification error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Webhook signature verification failed',
    });
  }
};
