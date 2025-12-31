export const loadRazorpayScript = async (): Promise<boolean> => {
  return false;
};

export const openRazorpayCheckout = async (): Promise<void> => {
  throw new Error("Payment gateway disabled");
};

export const verifyPayment = async (): Promise<{ success: boolean; error?: string }> => {
  return { success: false, error: "Payment gateway disabled" };
};
