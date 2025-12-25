import { CartRepository } from "../repositories/CartRepository";
import { ProductRepository } from "../repositories/ProductRepository";
import { Cart, CartItem, AddToCartRequest, UpdateCartItemRequest, RemoveFromCartRequest, CartResponse, CartItemResponse } from "../types/CartTypes";
import { formatCartItem, calculateCartTotals } from "../utils/CartUtils";

export class CartService {
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
  }

  async getCart(userId: string): Promise<CartResponse> {
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
    const originalItems: any[] = cart.items || [];
    const formattedItems: CartItem[] = originalItems.map((item: any) =>
      formatCartItem(item)
    );

    // Treat items whose formatted name is empty as invalid (product deleted by admin)
    const validIndexes: number[] = [];
    const cleanedFormattedItems: CartItem[] = [];

    formattedItems.forEach((fItem: CartItem, index: number) => {
      if (fItem.name) {
        validIndexes.push(index);
        cleanedFormattedItems.push(fItem);
      }
    });

    const hadDeletedItems = cleanedFormattedItems.length !== formattedItems.length;

    if (hadDeletedItems) {
      console.log('[CartService] getCart - removing items whose products were deleted by admin');
      cart.items = originalItems.filter((_: any, index: number) =>
        validIndexes.includes(index)
      );
    }

    const totals = calculateCartTotals(cleanedFormattedItems);
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

  async addToCart(userId: string, request: AddToCartRequest): Promise<CartItemResponse> {
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
    const cart = await this.cartRepository.atomicAddToCart(
      userId,
      product._id.toString(),
      product.name,
      product.price,
      typeof product.images[0] === 'string' 
        ? product.images[0] 
        : (product.images[0] as any)?.thumb || (product.images[0] as any)?.full || "/placeholder-product.svg",
      quantity
    );

    // Get cart with populated product details for response
    const populatedCart = await this.cartRepository.findByUserIdWithPopulate(userId);

    return {
      message: "Item added to cart",
      cart: {
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    };
  }

  async updateCartItem(userId: string, request: UpdateCartItemRequest): Promise<CartItemResponse> {
    const { productId, quantity } = request;

    // Validate required fields
    if (!productId) {
      throw new Error("Product ID is required");
    }

    if (quantity === undefined || quantity === null) {
      throw new Error("Quantity is required");
    }

    // Ensure cart exists and item is present before validating the product
    const existingCart = await this.cartRepository.findByUserId(userId);
    if (!existingCart) {
      throw new Error("Cart not found");
    }

    const hasItem = (existingCart.items || []).some((it: any) =>
      String(it.productId) === String(productId)
    );

    if (!hasItem) {
      throw new Error("Item not found in cart");
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
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    };
  }

  async removeFromCart(userId: string, request: RemoveFromCartRequest): Promise<CartItemResponse> {
    const { productId } = request;

    if (!productId) {
      throw new Error("Product ID is required");
    }

    const existingCart = await this.cartRepository.findByUserId(userId);
    if (!existingCart) {
      throw new Error("Cart not found");
    }

    const hasItem = (existingCart.items || []).some((it: any) =>
      String(it.productId) === String(productId)
    );

    if (!hasItem) {
      throw new Error("Item not found in cart");
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
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    };
  }

  async clearCart(userId: string): Promise<CartItemResponse> {
    const existingCart = await this.cartRepository.findByUserId(userId);
    if (!existingCart) {
      throw new Error("Cart not found");
    }

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
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    };
  }
}
