import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order } from '../../../models/Order';

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId' });
    }

    // Enforce ownership — users can only read their own order's payment status
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      amount: order.totalAmount,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      verifiedAt: order.paymentVerifiedAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payment status' });
  }
};
