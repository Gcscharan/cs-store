import { Request, Response } from "express";
import { CartService } from "../services/CartService";
import { IUser } from "../../../models/User";

const cartService = new CartService();

export const getCart = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    console.log('[CartController] getCart - req.user exists:', !!req.user);
    if (req.user) {
      console.log('[CartController] getCart - req.user._id exists:', !!(req.user as IUser)._id);
      console.log('[CartController] getCart - req.user._id value:', (req.user as IUser)._id);
    }
    
    if (!req.user || !(req.user as IUser)._id) {
      console.log('[CartController] getCart - returning 401 Unauthorized');
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = (req.user as IUser)._id.toString();
    console.log('[CartController] getCart - userId:', userId);
    const result = await cartService.getCart(userId);
    console.log('[CartController] getCart - result:', result);
    res.json(result);
  } catch (error) {
    console.log('[CartController] getCart - error:', error);
    
    const message = error instanceof Error ? error.message : "Failed to fetch cart";
    
    // Return specific status codes based on error type
    if (message === "Invalid user identifier") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    res.status(500).json({ message });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.user || !(req.user as IUser)._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = (req.user as IUser)._id.toString();
    const result = await cartService.addToCart(userId, req.body);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add item to cart";
    
    // Return specific status codes based on error type
    if (message === "Product ID is required") {
      return res.status(400).json({ message });
    }
    if (message === "Quantity must be greater than 0") {
      return res.status(400).json({ message });
    }
    if (message === "Product not found") {
      return res.status(404).json({ message });
    }
    if (message === "Insufficient stock") {
      return res.status(400).json({ message });
    }
    
    res.status(500).json({ message });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.user || !(req.user as IUser)._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = (req.user as IUser)._id.toString();
    const result = await cartService.updateCartItem(userId, req.body);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update cart item";
    
    // Return specific status codes based on error type
    if (message === "Product ID is required") {
      return res.status(400).json({ message });
    }
    if (message === "Quantity is required") {
      return res.status(400).json({ message });
    }
    if (message === "Product not found") {
      return res.status(404).json({ message });
    }
    if (message === "Insufficient stock") {
      return res.status(400).json({ message });
    }
    if (message === "Cart not found") {
      return res.status(404).json({ message });
    }
    if (message === "Item not found in cart") {
      return res.status(404).json({ message });
    }
    
    res.status(500).json({ message });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.user || !(req.user as IUser)._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = (req.user as IUser)._id.toString();
    const productId = (req.params as any).productId || (req.body as any).productId;
    
    // Validate productId
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }
    
    const result = await cartService.removeFromCart(userId, { productId });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove item from cart";
    
    // Return specific status codes based on error type
    if (message === "Product ID is required") {
      return res.status(400).json({ message });
    }
    if (message === "Cart not found") {
      return res.status(404).json({ message });
    }
    if (message === "Item not found in cart") {
      return res.status(404).json({ message });
    }
    
    res.status(500).json({ message });
  }
};

export const clearCart = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.user || !(req.user as IUser)._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = (req.user as IUser)._id.toString();
    const result = await cartService.clearCart(userId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clear cart";
    
    // Return specific status codes based on error type
    if (message === "Cart not found") {
      return res.status(404).json({ message });
    }
    
    res.status(500).json({ message });
  }
};
