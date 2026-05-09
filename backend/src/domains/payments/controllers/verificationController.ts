import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order } from '../../../models/Order';
import { getRazorpayClient } from '../../../utils/razorpay';
import { logger } from '../../../utils/logger';
import { paymentMetricsService } from '../services/paymentMetricsService';
import { finalizeOrderOnCapturedPayment } from '../services/orderPaymentFinalizer';

/**
 * Payment Verification Controller
 * 
 * Verifies UPI payment status by checking with Razorpay API.
 * This controller is called by the mobile app after the user completes
 * payment in their UPI app.
 * 
 * Requirements: TR-003, BR-002
 */

/**
 * Verify payment status for an order
 * 
 * @route GET /api/payments/verify/:orderId
 * @param req.params.orderId - Order ID to verify
 * @param req.user._id - Authenticated user ID
 * @returns Payment verification response
 */
export const verifyPayment = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?._id;

    // NFR-004: Log polling attempt received (order ID, user)
    logger.debug('[Payment] Polling attempt received', {
      orderId,
      userId: userId?.toString(),
    });

    // Validate user is authenticated
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId' });
    }

    // Fetch order and validate user ownership
    const order = await Order.findOne({ 
      _id: orderId, 
      userId 
    });

    if (!order) {
      logger.warn('[Payment] Order not found or unauthorized', { 
        orderId, 
        userId: userId.toString() 
      });
      return res.status(404).json({ 
        message: 'Order not found' 
      });
    }

    // If already paid, return immediately (optimization)
    if (order.paymentStatus === 'PAID') {
      const duration = Date.now() - startTime;
      
      // NFR-004: Log payment already verified
      logger.info('[Payment] Payment already verified', {
        orderId: order._id.toString(),
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        verifiedAt: order.paymentVerifiedAt,
        verificationMethod: 'cached',
        duration,
      });

      return res.json({
        orderId: order._id,
        paymentStatus: 'PAID',
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        verifiedAt: order.paymentVerifiedAt,
        amount: order.totalAmount,
      });
    }

    // Check with Razorpay if order has razorpayOrderId
    if (order.razorpayOrderId) {
      try {
        const razorpay = getRazorpayClient();
        
        // NFR-004: Log Razorpay API call
        logger.info('[Payment] Fetching payment status from Razorpay', {
          orderId: order._id.toString(),
          razorpayOrderId: order.razorpayOrderId,
        });
        
        // Fetch payments for this Razorpay order
        const paymentsResponse = await razorpay.orders.fetchPayments(
          order.razorpayOrderId
        );

        logger.debug('[Payment] Razorpay payments fetched', {
          orderId: order._id.toString(),
          razorpayOrderId: order.razorpayOrderId,
          paymentsCount: paymentsResponse.items?.length || 0,
        });

        // Find captured payment
        const capturedPayment = paymentsResponse.items?.find(
          (payment: any) => payment.status === 'captured'
        );

        if (capturedPayment) {
          // Payment captured in Razorpay — update DB immediately so
          // the order reflects PAID regardless of webhook timing.
          const duration = Date.now() - startTime;

          // NFR-004: Log payment verified via polling
          logger.info('[Payment] Payment verified via polling', {
            orderId: order._id.toString(),
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: capturedPayment.id,
            amount: Number(capturedPayment.amount || 0) / 100,
            currentOrderStatus: order.paymentStatus,
            verificationMethod: 'polling',
            duration,
          });

          // Track metrics: payment success via polling
          paymentMetricsService.trackPaymentSuccess({
            orderId: order._id.toString(),
            razorpayOrderId: order.razorpayOrderId!,
            razorpayPaymentId: capturedPayment.id,
            verificationTimeMs: duration,
            verificationMethod: 'polling',
          });

          // Update DB now so order status is consistent even if webhook hasn't fired yet.
          // Route through finalizeOrderOnCapturedPayment — same path as the webhook —
          // so the correct paymentStatusSource guard is satisfied and inventory is committed.
          let verifiedAt = order.paymentVerifiedAt;
          if ((order.paymentStatus as string) !== 'PAID') {
            try {
              // Start a transaction to ensure inventory commit and finalization are atomic
              const session = await mongoose.startSession();
              try {
                await session.withTransaction(async () => {
                  // CRITICAL: Commit inventory BEFORE finalization
                  const orderItems = Array.isArray(order.items) ? (order.items as any[]) : [];
                  const items = orderItems.map((it: any) => ({
                    productId: it.productId,
                    qty: Number(it.qty ?? it.quantity ?? 0),
                  }));

                  if (items.length > 0) {
                    const { inventoryReservationService } = await import('../../orders/services/inventoryReservationService');
                    const { InventoryReservation } = await import('../../../models/InventoryReservation');
                    
                    await inventoryReservationService.reserveForOrder({
                      session,
                      orderId: new mongoose.Types.ObjectId(order._id.toString()),
                      ttlMs: 30 * 60_000,
                      items,
                    });

                    const res = await inventoryReservationService.commitReservationsForOrder({
                      session,
                      orderId: new mongoose.Types.ObjectId(order._id.toString()),
                    });

                    if (!res.committed) {
                      // Either already committed, or missing reservations
                      const committedCount = await InventoryReservation.countDocuments({
                        orderId: new mongoose.Types.ObjectId(order._id.toString()),
                        status: "COMMITTED",
                      }).session(session);
                      if (Number(committedCount || 0) === 0) {
                        throw new Error("Inventory commit missing for paid order");
                      }
                    }
                  }

                  // Now finalize the order atomically
                  const out = await finalizeOrderOnCapturedPayment({
                    orderId: order._id.toString(),
                    razorpayOrderId: order.razorpayOrderId,
                    razorpayPaymentId: capturedPayment.id,
                    capturedAt: capturedPayment.created_at
                      ? new Date(Number(capturedPayment.created_at) * 1000)
                      : new Date(),
                    confirmedBy: 'POLLING',
                    session,
                  });
                  
                  if (out.updated) {
                    verifiedAt = new Date();
                    logger.info('[Payment] Order marked PAID via polling (finalizer)', {
                      orderId: order._id.toString(),
                      razorpayPaymentId: capturedPayment.id,
                    });
                  } else {
                    logger.info('[Payment] Order already finalized by another worker (polling)', {
                      orderId: order._id.toString(),
                      razorpayPaymentId: capturedPayment.id,
                      note: 'Another worker already finalized this order (idempotent)',
                    });
                  }
                });
              } finally {
                session.endSession();
              }
            } catch (updateErr: any) {
              // Non-fatal — webhook will handle it. Still return PAID to frontend.
              logger.warn('[Payment] Could not write PAID status from polling (webhook will handle)', {
                orderId: order._id.toString(),
                error: updateErr?.message,
              });
            }
          }

          return res.json({
            orderId: order._id,
            paymentStatus: 'PAID',
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: capturedPayment.id,
            verifiedAt: verifiedAt || new Date(),
            amount: order.totalAmount,
          });
        }

        // Check for failed payment
        const failedPayment = paymentsResponse.items?.find(
          (payment: any) => payment.status === 'failed'
        );

        if (failedPayment) {
          logger.info('[Payment] Payment failed at gateway', {
            orderId: order._id.toString(),
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: failedPayment.id,
            verificationMethod: 'polling',
          });

          paymentMetricsService.trackPaymentFailure({
            orderId: order._id.toString(),
            razorpayOrderId: order.razorpayOrderId,
            reason: 'payment_failed_in_razorpay',
          });

          // Mark order FAILED — safe, no PAID transition involved
          await Order.updateOne(
            { _id: order._id, paymentStatus: 'PENDING' },
            { $set: { paymentStatus: 'FAILED' } }
          );
        }

      } catch (razorpayError: any) {
        // Sample Razorpay API errors at 20% to prevent log flooding during outages
        if (Math.random() < 0.2) {
          logger.error('[Payment] Razorpay API error during verification', {
            orderId: order._id.toString(),
            razorpayOrderId: order.razorpayOrderId,
            error: razorpayError.message,
            statusCode: razorpayError.statusCode,
          });
        }
        // Continue to return current status even if Razorpay API fails
      }
    }

    // Return current status (PENDING or FAILED)
    const duration = Date.now() - startTime;
    
    // NFR-004: Log payment still pending
    logger.info('[Payment] Payment status check - still pending', {
      orderId: order._id.toString(),
      razorpayOrderId: order.razorpayOrderId,
      paymentStatus: order.paymentStatus,
      duration,
    });

    return res.json({
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      razorpayOrderId: order.razorpayOrderId,
      amount: order.totalAmount,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // NFR-004: Log unexpected errors with context
    logger.error('[Payment] Unexpected error during verification', {
      orderId: req.params.orderId,
      error: error.message,
      stack: error.stack,
      duration,
    });

    return res.status(500).json({ 
      message: 'Failed to verify payment' 
    });
  }
};
