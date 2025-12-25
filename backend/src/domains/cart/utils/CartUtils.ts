import { CartItem } from "../types/CartTypes";

export const formatCartItem = (item: any): CartItem => {
  const productId = item.productId;
  
  // Check if productId is populated (has product properties)
  if (productId && typeof productId === 'object' && 'name' in productId) {
    const populatedProduct = productId as any;
    const isOutOfStock = typeof populatedProduct.stock === 'number' && populatedProduct.stock <= 0;
    return {
      productId: populatedProduct._id.toString(),
      name: populatedProduct.name,
      // If product is out of stock, treat price as 0 so totals exclude it
      price: isOutOfStock ? 0 : populatedProduct.price,
      image: typeof populatedProduct.images?.[0] === 'string' 
        ? populatedProduct.images[0] 
        : (populatedProduct.images?.[0] as any)?.thumb || (populatedProduct.images?.[0] as any)?.full || "",
      quantity: item.quantity,
    };
  } else {
    // Fallback for non-populated productId
    return {
      productId: productId ? productId.toString() : "",
      name: "",
      price: 0,
      image: "",
      quantity: item.quantity,
    };
  }
};

export const calculateCartTotals = (items: CartItem[]): { total: number; itemCount: number } => {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { total, itemCount };
};
