import { Request, Response } from 'express';
import { Order } from '../../../models/Order';

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ paymentStatus: order.paymentStatus });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payment status' });
  }
};
