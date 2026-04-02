export function calculateCartTotal(cartItems: Array<{ price: number; quantity: number; discount?: number }>): number {
  if (!cartItems || cartItems.length === 0) {
    return 0;
  }
  
  return cartItems.reduce((total, item) => {
    const itemTotal = item.price * item.quantity;
    const discountAmount = item.discount ? (itemTotal * item.discount) / 100 : 0;
    return total + (itemTotal - discountAmount);
  }, 0);
}

export function calculateGST(subtotal: number): number {
  if (subtotal < 0) {
    return 0;
  }
  return subtotal * 0.05; // 5% GST
}

export function calculateDeliveryFee(cartTotal: number, distance: number): number {
  const FREE_DELIVERY_THRESHOLD = 500; // ₹500
  
  if (cartTotal >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }
  
  // Base delivery fee + distance-based fee
  const baseFee = 40;
  const perKmFee = 5;
  
  return baseFee + (distance * perKmFee);
}
