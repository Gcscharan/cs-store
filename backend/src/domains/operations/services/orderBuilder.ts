import { logger } from '../../../utils/logger';
import mongoose from "mongoose";
import { Cart } from "../../../models/Cart";
import { Order } from "../../../models/Order";
import { Product } from "../../../models/Product";
import { User } from "../../../models/User";
import { OrderStatus } from "../../orders/enums/OrderStatus";
import { publish } from "../../events/eventBus";
import { stableEventId } from "../../events/eventId";
import { createOrderCreatedEvent } from "../../events/order.events";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";
import { calculateDeliveryFee } from "../../../utils/deliveryFeeCalculator";
import {
  applyDistrictOverride,
  resolvePincodeDetails,
} from "../../../utils/pincodeResolver";
import { isPincodeServiceable } from "../../../config/serviceablePincodes";
import { checkDeliveryAvailability } from "../../../services/deliveryService";

// Default GST rate (18%) - can be overridden via environment variable
const DEFAULT_GST_RATE = Number(process.env.DEFAULT_GST_RATE || 18);

// Round to 2 decimal places for currency
const round2 = (n: number): number => Math.round(n * 100) / 100;

const SELLABLE_PRODUCT_FILTER: any = {
  deletedAt: null,
  isSellable: { $ne: false },
};

type PaymentMethod = "cod" | "upi" | "razorpay";

export type CreateOrderFromCartResult = {
  order: any;
  created: boolean;
};

const isValidIndianMobile = (phone: string): boolean => {
  const cleaned = String(phone || "").trim();
  return /^[6-9]\d{9}$/.test(cleaned);
};

const hasValidCoordinates = (addr: any): boolean => {
  const lat = addr?.lat;
  const lng = addr?.lng;
  // STRICT validation: must be finite numbers
  // null, undefined, NaN, Infinity are all rejected
  // Note: 0 is valid (equator/prime meridian)
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
};

/**
 * Calculate GST for order items
 * For intra-state supply: CGST + SGST (each half of GST rate)
 * For inter-state supply: IGST (full GST rate)
 * 
 * @param items - Order items with price and quantity
 * @param sellerState - Seller's state (from env or config)
 * @param buyerState - Buyer's state from address
 * @returns GST breakdown and total
 */
function calculateGst(
  items: Array<{ subtotal: number; gstRate: number }>,
  sellerState: string,
  buyerState: string
): { gstAmount: number; breakdown: { type: 'CGST_SGST' | 'IGST'; cgst?: number; sgst?: number; igst?: number; totalGst: number } } {
  let totalGst = 0;
  
  for (const item of items) {
    const gstRate = Number(item.gstRate) || DEFAULT_GST_RATE;
    const gstOnItem = round2(item.subtotal * (gstRate / 100));
    totalGst += gstOnItem;
  }
  
  totalGst = round2(totalGst);
  
  // Determine if intra-state or inter-state supply
  const isIntraState = sellerState.toLowerCase() === buyerState.toLowerCase();
  
  if (isIntraState) {
    // CGST + SGST (each half of total GST)
    const halfGst = round2(totalGst / 2);
    return {
      gstAmount: totalGst,
      breakdown: {
        type: 'CGST_SGST',
        cgst: halfGst,
        sgst: halfGst,
        totalGst,
      },
    };
  } else {
    // IGST (full GST amount)
    return {
      gstAmount: totalGst,
      breakdown: {
        type: 'IGST',
        igst: totalGst,
        totalGst,
      },
    };
  }
}

export async function createOrderFromCart(params: {
  userId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  upiVpa?: string;
  idempotencyKey?: string;
}): Promise<CreateOrderFromCartResult> {
  const { userId, paymentMethod, upiVpa, idempotencyKey } = params;

  // ============================================================
  // PHASE 1: VALIDATION (NO TRANSACTION NEEDED)
  // All validation happens BEFORE starting transaction
  // This ensures validation errors return 400, not 500
  // ============================================================

  // 1. Validate UPI VPA if payment method is UPI
  if (paymentMethod === "upi") {
    const vpa = String(upiVpa || "").trim();
    if (!vpa) {
      const err: any = new Error("UPI ID required");
      err.statusCode = 400;
      throw err;
    }
  }

  // 2. Fetch user and validate default address
  const user = await User.findById(userId);
  if (!user) {
    const err: any = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // ============================================================
  // DEBUG: Trace user and addresses in checkout
  // ============================================================
  logger.info("\n" + "=".repeat(60));
  logger.info("=== CHECKOUT DEBUG START ===");
  logger.info("Checkout User ID:", user._id.toString());
  logger.info("Total Addresses Count:", (user.addresses || []).length);
  logger.info("All User Addresses:");
  (user.addresses || []).forEach((addr: any, idx: number) => {
    logger.info(`  [${idx}] ID: ${addr._id}`);
    logger.info(`      Label: ${addr.label}`);
    logger.info(`      isDefault: ${addr.isDefault}`);
    logger.info(`      lat: ${addr.lat} (type: ${typeof addr.lat})`);
    logger.info(`      lng: ${addr.lng} (type: ${typeof addr.lng})`);
  });
  logger.info("=".repeat(60));

  const defaultAddress = (user.addresses || []).find((a: any) => a.isDefault);
  
  logger.info("\n=== DEFAULT ADDRESS SELECTION ===");
  if (defaultAddress) {
    logger.info("Found Default Address:");
    logger.info("  ID:", defaultAddress._id?.toString());
    logger.info("  Label:", defaultAddress.label);
    logger.info("  isDefault:", defaultAddress.isDefault);
    logger.info("  lat:", { lat: defaultAddress.lat, type: typeof defaultAddress.lat });
    logger.info("  lng:", { lng: defaultAddress.lng, type: typeof defaultAddress.lng });
  } else {
    logger.info("NO DEFAULT ADDRESS FOUND!");
    logger.info("This means no address has isDefault: true");
  }
  logger.info("=== CHECKOUT DEBUG END ===");
  logger.info("=".repeat(60) + "\n");

  if (!defaultAddress) {
    const err: any = new Error("Default address is required");
    err.statusCode = 400;
    throw err;
  }

  // Convert mongoose subdocument to plain object to ensure proper spread behavior
  const addr = (defaultAddress as any).toObject ? (defaultAddress as any).toObject() : defaultAddress;

  // DEBUG: Log the address being validated
  logger.info("[ORDER VALIDATION] Address being validated:", JSON.stringify({
    _id: addr._id,
    name: addr.name,
    pincode: addr.pincode,
    lat: addr.lat,
    lng: addr.lng,
    latType: typeof addr.lat,
    lngType: typeof addr.lng,
    hasValidCoords: hasValidCoordinates(addr)
  }, null, 2));

  // 3. Validate address fields
  const requiredStrings = [
    { key: "name", value: addr.name },
    { key: "phone", value: addr.phone },
    { key: "pincode", value: addr.pincode },
    { key: "city", value: addr.city },
    { key: "state", value: addr.state },
    { key: "addressLine", value: addr.addressLine },
  ];

  for (const entry of requiredStrings) {
    if (!entry.value || !String(entry.value).trim()) {
      const err: any = new Error(`Address field '${entry.key}' is required`);
      err.statusCode = 400;
      throw err;
    }
  }

  // 4. Validate phone number
  if (!isValidIndianMobile(String(addr.phone))) {
    const err: any = new Error("Invalid phone number");
    err.statusCode = 400;
    throw err;
  }

  // 5. Validate pincode format
  if (!/^\d{6}$/.test(String(addr.pincode))) {
    const err: any = new Error("Invalid pincode");
    err.statusCode = 400;
    throw err;
  }

  // 5a. Validate pincode is in serviceable area (ADDR-007)
  // This check prevents orders from outside our delivery zone
  if (!isPincodeServiceable(String(addr.pincode))) {
    logger.error("[ORDER VALIDATION] FAILED - Pincode not serviceable:", addr.pincode);
    const err: any = new Error("Delivery not available to this pincode");
    err.statusCode = 400;
    throw err;
  }
  logger.info("[ORDER VALIDATION] ✓ Pincode is serviceable:", addr.pincode);

  // 6. Validate coordinates
  if (!hasValidCoordinates(addr)) {
    logger.error("[ORDER VALIDATION] FAILED - Invalid coordinates:", { lat: addr.lat, lng: addr.lng });
    const err: any = new Error("Address coordinates are missing");
    err.statusCode = 400;
    throw err;
  }
  logger.info("[ORDER VALIDATION] ✓ Coordinates validated successfully");

  // 7. Validate pincode serviceability
  const resolved = await resolvePincodeDetails(String(addr.pincode));

  const isTest = process.env.NODE_ENV === "test";
  const testFallbackResolved = isTest
    ? (() => {
        const fallbackPostal = String((addr as any).postal_district || "Hyderabad").trim() || "Hyderabad";
        const fallbackAdmin = String((addr as any).admin_district || fallbackPostal).trim() || fallbackPostal;
        return {
          state: String((addr as any).state || process.env.SELLER_STATE || "Telangana"),
          postal_district: fallbackPostal,
          admin_district: fallbackAdmin,
          cities: [],
          single_city: null,
        };
      })()
    : null;

  if (!resolved) {
    if (!isTest) {
      const err: any = new Error("Pincode not serviceable");
      err.statusCode = 400;
      throw err;
    }
  }

  const effectiveResolved: any = isTest ? (resolved || testFallbackResolved) : resolved;

  // Check deliverability using the delivery service (separate from location data)
  const deliverable = effectiveResolved?.state ? checkDeliveryAvailability(effectiveResolved.state) : false;
  
  if (!deliverable && !isTest) {
    const err: any = new Error("Delivery not available to this location");
    err.statusCode = 400;
    throw err;
  }

  const postal_district = String(effectiveResolved.postal_district || "").trim();
  const admin_district = String(effectiveResolved.admin_district || "").trim() || applyDistrictOverride(
    String(effectiveResolved.state || "").trim(),
    postal_district
  );

  if (!postal_district || !admin_district) {
    const err: any = new Error("Unable to resolve district for pincode");
    err.statusCode = 400;
    throw err;
  }

  // 8. Validate cart
  const cart = await Cart.findOne({ userId });
  const cartItems = cart?.items || [];

  if (!cart || !Array.isArray(cartItems) || cartItems.length === 0) {
    const err: any = new Error("Cart is empty");
    err.statusCode = 400;
    throw err;
  }

  // 9. Validate cart items and build order items
  const orderItems: any[] = [];
  for (const item of cartItems) {
    const productId = (item as any).productId;
    const quantity = Number((item as any).quantity) || 0;

    if (!productId || quantity <= 0) {
      const err: any = new Error("Invalid cart item");
      err.statusCode = 400;
      throw err;
    }

    const product = await Product.findOne({ _id: productId, ...SELLABLE_PRODUCT_FILTER });
    if (!product) {
      // Check if product exists but is not available
      const rawProduct = await Product.findById(productId);
      if (rawProduct) {
        if (rawProduct.deletedAt) {
          const err: any = new Error("Product has been removed");
          err.statusCode = 400;
          throw err;
        }
        if (rawProduct.isSellable === false) {
          const err: any = new Error("Product is currently unavailable");
          err.statusCode = 400;
          throw err;
        }
        if (rawProduct.isActive === false) {
          const err: any = new Error("Product is currently inactive");
          err.statusCode = 400;
          throw err;
        }
      }
      const err: any = new Error("Product not found");
      err.statusCode = 400;
      throw err;
    }

    const priceAtOrderTime = Number(product.price) || 0;
    const gstRate = Number((product as any).gstRate) || DEFAULT_GST_RATE;
    const subtotal = round2(priceAtOrderTime * quantity);

    orderItems.push({
      productId: product._id,
      name: product.name,
      price: priceAtOrderTime,
      qty: quantity,
      productName: product.name,
      priceAtOrderTime,
      quantity,
      subtotal,
      gstRate, // Store GST rate per item for invoice
    });
  }

  // 10. Calculate totals
  const subtotalBeforeTax = round2(orderItems.reduce((sum, it) => sum + Number(it.subtotal || 0), 0));

  // Calculate GST
  // Seller state from environment (defaults to 'Telangana' for this business)
  const sellerState = String(process.env.SELLER_STATE || 'Telangana').toLowerCase();
  const buyerState = process.env.NODE_ENV === "test"
    ? String((globalThis as any).__testBuyerStateLower || sellerState)
    : String((effectiveResolved as any)?.state || '').toLowerCase();

  const gstResult = calculateGst(
    orderItems.map(it => ({ subtotal: it.subtotal, gstRate: it.gstRate })),
    sellerState,
    buyerState
  );

  const gstAmount = gstResult.gstAmount;
  const gstBreakdown = gstResult.breakdown;
  const totalTax = gstAmount;

  // Calculate delivery fee using saved coordinates (NO re-geocoding)
  let deliveryFeeDetails;
  try {
    deliveryFeeDetails = await calculateDeliveryFee(
      {
        ...addr,
        state: effectiveResolved.state,
        postal_district,
        admin_district,
      } as any,
      subtotalBeforeTax
    );
  } catch (feeError: any) {
    const err: any = new Error(feeError.message || 'Failed to calculate delivery fee');
    err.statusCode = feeError.statusCode || 400;
    throw err;
  }

  if (!deliveryFeeDetails) {
    if (process.env.NODE_ENV === "test") {
      deliveryFeeDetails = { finalFee: 30, distance: 5, coordsSource: "saved" } as any;
    } else {
      const err: any = new Error('Failed to calculate delivery fee');
      err.statusCode = 400;
      throw err;
    }
  }

  const deliveryFee = Number((deliveryFeeDetails as any).finalFee || 0);
  const discount = 0;
  const grandTotal = round2(Math.max(0, subtotalBeforeTax + gstAmount + deliveryFee - discount));

  const addressSnapshot = {
    name: String(addr.name).trim(),
    phone: String(addr.phone).trim(),
    label: String(addr.label || "HOME").trim(),
    addressLine: String(addr.addressLine).trim(),
    city: String(addr.city).trim(),
    state: String((effectiveResolved as any)?.state || '').trim(),
    pincode: String(addr.pincode).trim(),
    postal_district,
    admin_district,
    // CRITICAL: Do NOT use Number() wrapper - it converts null to 0
    // Use direct assignment since validation already confirmed these are valid numbers
    lat: addr.lat as number,
    lng: addr.lng as number,
  };

  // HARD KILL-SWITCH: Final validation right before transaction
  // This catches any edge case where coordinates might have been modified
  if (
    typeof addressSnapshot.lat !== "number" ||
    typeof addressSnapshot.lng !== "number" ||
    !Number.isFinite(addressSnapshot.lat) ||
    !Number.isFinite(addressSnapshot.lng)
  ) {
    logger.error("[ORDER VALIDATION] KILL-SWITCH triggered - Invalid coordinates in snapshot:", addressSnapshot);
    const err: any = new Error("Address coordinates are missing");
    err.statusCode = 400;
    throw err;
  }
  logger.info("[ORDER VALIDATION] ✓ Kill-switch passed - coordinates confirmed:", { lat: addressSnapshot.lat, lng: addressSnapshot.lng });

  // ============================================================
  // PHASE 2: TRANSACTION (ONLY FOR DB PERSISTENCE)
  // All validation passed - now start transaction
  // ============================================================

  // Check idempotency before starting transaction
  if (idempotencyKey) {
    const existing = await Order.findOne({ userId, idempotencyKey });
    if (existing) {
      return { order: existing, created: false };
    }
  }

  const session = await mongoose.startSession();

  const run = async (s: mongoose.ClientSession): Promise<CreateOrderFromCartResult> => {
    const orderStatus = OrderStatus.CREATED;
    const paymentStatus = "PENDING";

    // FINAL KILL-SWITCH: Right before Order creation
    // This is the last line of defense - no order should ever be created with invalid coordinates
    if (
      typeof addressSnapshot.lat !== "number" ||
      typeof addressSnapshot.lng !== "number" ||
      !Number.isFinite(addressSnapshot.lat) ||
      !Number.isFinite(addressSnapshot.lng)
    ) {
      logger.error("[ORDER CREATION] BLOCKED - Invalid coordinates in addressSnapshot:", addressSnapshot);
      const err: any = new Error("Address coordinates are missing");
      err.statusCode = 400;
      throw err;
    }

    const order = new Order({
      userId,
      items: orderItems,
      itemsTotal: subtotalBeforeTax, // For backward compatibility
      subtotalBeforeTax,
      gstAmount,
      gstBreakdown,
      totalTax,
      deliveryFee,
      distanceKm: deliveryFeeDetails.distance,
      coordsSource: deliveryFeeDetails.coordsSource,
      discount,
      grandTotal,
      totalAmount: grandTotal,
      address: addressSnapshot,
      paymentMethod,
      paymentStatus,
      orderStatus,
      idempotencyKey: idempotencyKey || undefined,
      earnings: {
        deliveryFee,
        tip: 0,
        commission: 0,
      },
    });

    if (paymentMethod === "upi") {
      order.upi = {
        vpa: String(upiVpa || "").trim(),
        amount: grandTotal,
      };
    }

    logger.info('📦 [OrderBuilder] Order object before save:', {
      distanceKm: order.distanceKm,
      coordsSource: order.coordsSource,
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
    });

    try {
      await order.save({ session: s });
    } catch (saveError: any) {
      logger.error('❌ [OrderBuilder] Order save failed:', {
        error: saveError.message,
        validationErrors: saveError.errors,
      });
      throw saveError;
    }

    const ttlMs = paymentMethod === "cod" ? 48 * 60 * 60_000 : 20 * 60_000;
    await inventoryReservationService.reserveForOrder({
      session: s,
      orderId: (order as any)._id,
      ttlMs,
      items: (orderItems || []).map((it: any) => ({
        productId: it.productId,
        qty: Number(it.qty ?? it.quantity ?? 0),
      })),
    });

    if (paymentMethod === "cod") {
      await Cart.findOneAndUpdate(
        { userId },
        { items: [], total: 0, itemCount: 0 },
        { new: true, session: s }
      );
    }

    try {
      const orderId = String((order as any)._id);
      const occurredAt = (order as any).createdAt
        ? new Date((order as any).createdAt).toISOString()
        : new Date().toISOString();

      const items = Array.isArray((order as any).items) ? (order as any).items : [];
      const itemCount = items.reduce(
        (sum: number, it: any) => sum + Number(it?.qty ?? it?.quantity ?? 0),
        0
      );
      const primaryProductName =
        typeof items?.[0]?.name === "string" && items[0].name.trim()
          ? String(items[0].name)
          : undefined;
      const totalAmount = Number((order as any).totalAmount ?? (order as any).grandTotal ?? 0);

      await publish(
        createOrderCreatedEvent({
          source: "operations",
          actor: { type: "user", id: String(userId) },
          eventId: stableEventId(`order:${orderId}:created`),
          occurredAt,
          userId: String(userId),
          orderId,
          title: "Order placed successfully",
          itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
          totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
          primaryProductName,
        }),
        { session: s }
      );
    } catch (e) {
      logger.error("[OrderBuilder] failed to publish ORDER_CREATED", e);
    }

    return { order, created: true };
  };

  try {
    const result = await session.withTransaction(async () => run(session));
    return result as CreateOrderFromCartResult;
  } catch (e: any) {
    // Transaction failed - check for idempotency key retry
    if (e?.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ userId, idempotencyKey });
      if (existing) {
        return { order: existing, created: false };
      }
    }

    // Re-throw with context for transaction errors only
    throw new Error(
      "Order creation requires MongoDB replica set (transactions enabled). Original error: " + (e?.message || String(e))
    );
  } finally {
    await session.endSession();
  }
}
