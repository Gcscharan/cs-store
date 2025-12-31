export const createRazorpayOrder = async () => {
  throw new Error("Payment gateway disabled");
};

export const verifyPayment = async () => {
  throw new Error("Payment gateway disabled");
};

export const openRazorpayCheckout = async () => {
  throw new Error("Payment gateway disabled");
};

export default {
  createRazorpayOrder,
  verifyPayment,
  openRazorpayCheckout,
};
