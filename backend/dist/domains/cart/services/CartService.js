"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartService = void 0;
const CartRepository_1 = require("../repositories/CartRepository");
const ProductRepository_1 = require("../repositories/ProductRepository");
const CartUtils_1 = require("../utils/CartUtils");
class CartService {
    constructor() {
        this.cartRepository = new CartRepository_1.CartRepository();
        this.productRepository = new ProductRepository_1.ProductRepository();
    }
    async getCart(userId) {
        console.log('[CartService] getCart - userId:', userId);
        // Validate userId before proceeding
        if (!userId || userId === 'undefined' || userId === 'null') {
            console.log('[CartService] getCart - invalid userId, throwing error');
            throw new Error("Invalid user identifier");
        }
        let cart = await this.cartRepository.findByUserIdWithPopulate(userId);
        console.log('[CartService] getCart - cart found:', !!cart);
        if (cart) {
            console.log('[CartService] getCart - cart items count:', cart.items?.length || 0);
        }
        // For GET requests, return empty cart response without creating DB record
        if (!cart) {
            console.log('[CartService] getCart - no cart found, returning empty response');
            return {
                cart: {
                    items: [],
                    totalAmount: 0,
                    itemCount: 0,
                },
            };
        }
        // First format all items (this will handle out-of-stock products, etc.)
        const originalItems = cart.items || [];
        const formattedItems = originalItems.map((item) => (0, CartUtils_1.formatCartItem)(item));
        // Treat items whose formatted name is empty as invalid (product deleted by admin)
        const validIndexes = [];
        const cleanedFormattedItems = [];
        formattedItems.forEach((fItem, index) => {
            if (fItem.name) {
                validIndexes.push(index);
                cleanedFormattedItems.push(fItem);
            }
        });
        const hadDeletedItems = cleanedFormattedItems.length !== formattedItems.length;
        if (hadDeletedItems) {
            console.log('[CartService] getCart - removing items whose products were deleted by admin');
            cart.items = originalItems.filter((_, index) => validIndexes.includes(index));
        }
        const totals = (0, CartUtils_1.calculateCartTotals)(cleanedFormattedItems);
        cart.total = totals.total;
        cart.itemCount = totals.itemCount;
        if (hadDeletedItems) {
            await this.cartRepository.save(cart);
        }
        const result = {
            cart: {
                items: cleanedFormattedItems,
                totalAmount: totals.total,
                itemCount: totals.itemCount,
            },
        };
        console.log('[CartService] getCart - returning result with items:', result.cart.items.length);
        console.log('[CartService] getCart - totalAmount:', result.cart.totalAmount);
        return result;
    }
    async addToCart(userId, request) {
        const { productId, quantity = 1 } = request;
        // Validate required fields
        if (!productId) {
            throw new Error("Product ID is required");
        }
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }
        // Verify product exists and has stock
        const product = await this.productRepository.findById(productId);
        if (!product) {
            throw new Error("Product not found");
        }
        if (product.stock < quantity) {
            throw new Error("Insufficient stock");
        }
        // Atomic add to cart
        const cart = await this.cartRepository.atomicAddToCart(userId, product._id.toString(), product.name, product.price, typeof product.images[0] === 'string'
            ? product.images[0]
            : product.images[0]?.thumb || product.images[0]?.full || "/placeholder-product.svg", quantity);
        // Get cart with populated product details for response
        const populatedCart = await this.cartRepository.findByUserIdWithPopulate(userId);
        return {
            message: "Item added to cart",
            cart: {
                items: populatedCart?.items.map(CartUtils_1.formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        };
    }
    async updateCartItem(userId, request) {
        const { productId, quantity } = request;
        // Validate required fields
        if (!productId) {
            throw new Error("Product ID is required");
        }
        if (quantity === undefined || quantity === null) {
            throw new Error("Quantity is required");
        }
        // Verify product exists and has stock (only if quantity > 0)
        if (quantity > 0) {
            const product = await this.productRepository.findById(productId);
            if (!product) {
                throw new Error("Product not found");
            }
            if (product.stock < quantity) {
                throw new Error("Insufficient stock");
            }
        }
        // Atomic update cart item
        const cart = await this.cartRepository.atomicUpdateCartItem(userId, productId, quantity);
        if (!cart) {
            throw new Error("Cart not found");
        }
        // Get cart with populated product details for response
        const populatedCart = await this.cartRepository.findByUserIdWithPopulate(userId);
        return {
            message: "Cart updated",
            cart: {
                items: populatedCart?.items.map(CartUtils_1.formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        };
    }
    async removeFromCart(userId, request) {
        const { productId } = request;
        if (!productId) {
            throw new Error("Product ID is required");
        }
        // Atomic remove from cart
        const cart = await this.cartRepository.atomicRemoveFromCart(userId, productId);
        if (!cart) {
            throw new Error("Cart not found");
        }
        // Get cart with populated product details for response
        const populatedCart = await this.cartRepository.findByUserIdWithPopulate(userId);
        return {
            message: "Item removed from cart",
            cart: {
                items: populatedCart?.items.map(CartUtils_1.formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        };
    }
    async clearCart(userId) {
        // Atomic clear cart
        const cart = await this.cartRepository.atomicClearCart(userId);
        if (!cart) {
            throw new Error("Cart not found");
        }
        // Get cart with populated product details for response (will be empty after clear)
        const populatedCart = await this.cartRepository.findByUserIdWithPopulate(userId);
        return {
            message: "Cart cleared",
            cart: {
                items: populatedCart?.items.map(CartUtils_1.formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        };
    }
}
exports.CartService = CartService;
