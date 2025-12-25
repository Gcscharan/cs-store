"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCartTotals = exports.formatCartItem = void 0;
const formatCartItem = (item) => {
    const productId = item.productId;
    // Check if productId is populated (has product properties)
    if (productId && typeof productId === 'object' && 'name' in productId) {
        const populatedProduct = productId;
        const isOutOfStock = typeof populatedProduct.stock === 'number' && populatedProduct.stock <= 0;
        return {
            productId: populatedProduct._id.toString(),
            name: populatedProduct.name,
            // If product is out of stock, treat price as 0 so totals exclude it
            price: isOutOfStock ? 0 : populatedProduct.price,
            image: typeof populatedProduct.images?.[0] === 'string'
                ? populatedProduct.images[0]
                : populatedProduct.images?.[0]?.thumb || populatedProduct.images?.[0]?.full || "",
            quantity: item.quantity,
        };
    }
    else {
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
exports.formatCartItem = formatCartItem;
const calculateCartTotals = (items) => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return { total, itemCount };
};
exports.calculateCartTotals = calculateCartTotals;
