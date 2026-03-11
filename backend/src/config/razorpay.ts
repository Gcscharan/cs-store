import { logger } from '../utils/logger';
import Razorpay from "razorpay";

// Razorpay configuration
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

logger.info(
  "🔑 Razorpay configured with key:",
  process.env.RAZORPAY_KEY_ID ? "Live Key" : "Test Key"
);

export default razorpay;
