"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartService = void 0;
const logger_1 = require("../../../utils/logger");
const CartRepository_1 = require("../repositories/CartRepository");
const ProductRepository_1 = require("../repositories/ProductRepository");
const CartUtils_1 = require("../utils/CartUtils");
class CartService {
    constructor() {
        this.cartRepository = new CartRepository_1.CartRepository();
        this.productRepository = new ProductRepository_1.ProductRepository();
    }
    async getCart(userId) {
        logger_1.logger.info('[CartService] getCart - userId:', userId);
        // Validate userId before proceeding
        if (!userId || userId === 'undefined' || userId === 'null') {
            logger_1.logger.info('[CartService] getCart - invalid userId, throwing error');
            throw new Error("Invalid user identifier");
        }
        let cart = await this.cartRepository.findByUserIdWithPopulate(userId);
        logger_1.logger.info('[CartService] getCart - cart found:', !!cart);
        if (cart) {
            logger_1.logger.info('[CartService] getCart - cart items count:', cart.items?.length || 0);
        }
        // For GET requests, return empty cart response without creating DB record
        if (!cart) {
            logger_1.logger.info('[CartService] getCart - no cart found, returning empty response');
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
            logger_1.logger.info('[CartService] getCart - removing items whose products were deleted by admin');
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
        logger_1.logger.info('[CartService] getCart - returning result with items:', result.cart.items.length);
        logger_1.logger.info('[CartService] getCart - totalAmount:', result.cart.totalAmount);
        return result;
    }
    async addToCart(userId, request) {
        const { productId, quantity = 1 } = request;
        // Validate required fields
        if (!productId) {
            const err = new Error("Product ID is required");
            err.statusCode = 400;
            throw err;
        }
        if (quantity <= 0) {
            const err = new Error("Quantity must be greater than 0");
            err.statusCode = 400;
            throw err;
        }
        // Verify product exists and is available for purchase
        const product = await this.productRepository.findById(productId);
        logger_1.logger.info("[CART VALIDATION]", {
            productId,
            productFound: !!product,
            isSellable: product?.isSellable,
            deletedAt: product?.deletedAt,
            isActive: product?.isActive,
        });
        if (!product) {
            // Check if product exists but is unavailable
            const { Product } = await Promise.resolve().then(() => __importStar(require("../../../models/Product")));
            const rawProduct = await Product.findById(productId);
            logger_1.logger.info("[CART VALIDATION] Raw product check:", {
                found: !!rawProduct,
                isSellable: rawProduct?.isSellable,
                deletedAt: rawProduct?.deletedAt,
                isActive: rawProduct?.isActive,
            });
            if (rawProduct) {
                if (rawProduct.deletedAt) {
                    const err = new Error("Product has been removed");
                    err.statusCode = 400;
                    throw err;
                }
                if (rawProduct.isSellable === false) {
                    const err = new Error("Product is currently unavailable");
                    err.statusCode = 400;
                    throw err;
                }
                if (rawProduct.isActive === false) {
                    const err = new Error("Product is currently inactive");
                    err.statusCode = 400;
                    throw err;
                }
            }
            const err = new Error("Product not found");
            err.statusCode = 400;
            throw err;
        }
        const stock = Number(product.stock || 0);
        const reservedStock = Number(product.reservedStock || 0);
        const availableStock = stock - reservedStock;
        if (availableStock < quantity) {
            const err = new Error("Insufficient stock");
            err.statusCode = 400;
            throw err;
        }
        // Atomic add to cart
        const cart = await this.cartRepository.atomicAddToCart(userId, product._id.toString(), product.name, product.price, typeof product.images[0] === 'string'
            ? product.images[0]
            : product.images[0]?.variants?.thumb
                || product.images[0]?.variants?.small
                || product.images[0]?.variants?.medium
                || product.images[0]?.variants?.original
                || "/placeholder-product.svg", quantity);
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
            const err = new Error("Product ID is required");
            err.statusCode = 400;
            throw err;
        }
        if (quantity === undefined || quantity === null) {
            const err = new Error("Quantity is required");
            err.statusCode = 400;
            throw err;
        }
        // Ensure cart exists and item is present before validating the product
        const existingCart = await this.cartRepository.findByUserId(userId);
        if (!existingCart) {
            const err = new Error("Cart not found");
            err.statusCode = 404;
            throw err;
        }
        const hasItem = (existingCart.items || []).some((it) => String(it.productId) === String(productId));
        if (!hasItem) {
            const err = new Error("Item not found in cart");
            err.statusCode = 404;
            throw err;
        }
        // Verify product exists and has stock (only if quantity > 0)
        if (quantity > 0) {
            const product = await this.productRepository.findById(productId);
            if (!product) {
                const err = new Error("Product not found");
                err.statusCode = 400;
                throw err;
            }
            const stock = Number(product.stock || 0);
            const reservedStock = Number(product.reservedStock || 0);
            const availableStock = stock - reservedStock;
            if (availableStock < quantity) {
                const err = new Error("Insufficient stock");
                err.statusCode = 400;
                throw err;
            }
        }
        // Atomic update cart item
        const cart = await this.cartRepository.atomicUpdateCartItem(userId, productId, quantity);
        if (!cart) {
            const err = new Error("Cart not found");
            err.statusCode = 404;
            throw err;
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
            const err = new Error("Product ID is required");
            err.statusCode = 400;
            throw err;
        }
        const existingCart = await this.cartRepository.findByUserId(userId);
        if (!existingCart) {
            const err = new Error("Cart not found");
            err.statusCode = 404;
            throw err;
        }
        const hasItem = (existingCart.items || []).some((it) => String(it.productId) === String(productId));
        if (!hasItem) {
            const err = new Error("Item not found in cart");
            err.statusCode = 404;
            throw err;
        }
        // Atomic remove from cart
        const cart = await this.cartRepository.atomicRemoveFromCart(userId, productId);
        if (!cart) {
            const err = new Error("Cart not found");
            err.statusCode = 404;
            throw err;
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
        const existingCart = await this.cartRepository.findByUserId(userId);
        if (!existingCart) {
            const err = new Error("Cart not found");
            err.statusCode = 404;
            throw err;
        }
        // Atomic clear cart
        const cart = await this.cartRepository.atomicClearCart(userId);
        if (!cart) {
            const err = new Error("Cart not found");
            err.statusCode = 404;
            throw err;
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
