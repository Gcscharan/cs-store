import crypto from 'crypto';

export const verifyRazorpayWebhook = (req: any, res: any, next: any) => {
  try {
    const razorpaySignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!razorpaySignature) {
      return res.status(400).json({ error: 'Missing Razorpay signature' });
    }

    if (!webhookSecret) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (razorpaySignature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Webhook verification failed' });
  }
};
