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

type PaymentMethod = "cod" | "upi";

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
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat !== 0 &&
    lng !== 0 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
};

export async function createOrderFromCart(params: {
  userId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  upiVpa?: string;
  idempotencyKey?: string;
}): Promise<CreateOrderFromCartResult> {
  const { userId, paymentMethod, upiVpa, idempotencyKey } = params;

  if (idempotencyKey) {
    const existing = await Order.findOne({ userId, idempotencyKey });
    if (existing) {
      return { order: existing, created: false };
    }
  }

  const session = await mongoose.startSession();

  const isTxnUnsupportedError = (err: any): boolean => {
    const msg = String(err?.message || "");
    return (
      msg.includes("Transaction numbers are only allowed") ||
      msg.includes("not supported") ||
      msg.includes("replica set")
    );
  };

  const run = async (s?: mongoose.ClientSession): Promise<CreateOrderFromCartResult> => {
    const useSession = !!s;

    if (paymentMethod === "upi") {
      const vpa = String(upiVpa || "").trim();
      if (!vpa) {
        const err: any = new Error("UPI ID required");
        err.statusCode = 400;
        throw err;
      }
    }

    const user = useSession
      ? await User.findById(userId).session(s!)
      : await User.findById(userId);
      if (!user) {
        const err: any = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const defaultAddress = (user.addresses || []).find((a: any) => a.isDefault);
      if (!defaultAddress) {
        const err: any = new Error("Default address is required");
        err.statusCode = 400;
        throw err;
      }

      // Convert mongoose subdocument to plain object to ensure proper spread behavior
      const addr = (defaultAddress as any).toObject ? (defaultAddress as any).toObject() : defaultAddress;
      
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

      if (!isValidIndianMobile(String(addr.phone))) {
        const err: any = new Error("Invalid phone number");
        err.statusCode = 400;
        throw err;
      }

      if (!/^\d{6}$/.test(String(addr.pincode))) {
        const err: any = new Error("Invalid pincode");
        err.statusCode = 400;
        throw err;
      }

      if (!hasValidCoordinates(addr)) {
        const err: any = new Error("Address coordinates are missing");
        err.statusCode = 400;
        throw err;
      }

      const resolved = await resolvePincodeDetails(String(addr.pincode));
      if (!resolved || !resolved.deliverable) {
        const err: any = new Error("Pincode not serviceable");
        err.statusCode = 400;
        throw err;
      }

      const postal_district = String(resolved.postal_district || "").trim();
      const admin_district = applyDistrictOverride(
        String(resolved.state || "").trim(),
        postal_district
      );

      if (!postal_district || !admin_district) {
        const err: any = new Error("Unable to resolve district for pincode");
        err.statusCode = 400;
        throw err;
      }

      const cart = useSession
        ? await Cart.findOne({ userId }).session(s!)
        : await Cart.findOne({ userId });
      const cartItems = cart?.items || [];

      if (!cart || !Array.isArray(cartItems) || cartItems.length === 0) {
        const err: any = new Error("Cart is empty");
        err.statusCode = 400;
        throw err;
      }

      const orderItems: any[] = [];
      for (const item of cartItems) {
        const productId = (item as any).productId;
        const quantity = Number((item as any).quantity) || 0;

        if (!productId || quantity <= 0) {
          const err: any = new Error("Invalid cart item");
          err.statusCode = 400;
          throw err;
        }

        const product = useSession
          ? await Product.findById(productId).session(s!)
          : await Product.findById(productId);
        if (!product) {
          const err: any = new Error("Product not found");
          err.statusCode = 400;
          throw err;
        }

        const priceAtOrderTime = Number(product.price) || 0;
        const subtotal = priceAtOrderTime * quantity;

        orderItems.push({
          productId: product._id,
          name: product.name,
          price: priceAtOrderTime,
          qty: quantity,
          productName: product.name,
          priceAtOrderTime,
          quantity,
          subtotal,
        });
      }

      const itemsTotal = orderItems.reduce((sum, it) => sum + Number(it.subtotal || 0), 0);

      // Calculate delivery fee using saved coordinates (NO re-geocoding)
      let deliveryFeeDetails;
      try {
        deliveryFeeDetails = await calculateDeliveryFee(
          {
            ...addr,
            state: resolved.state,
            postal_district,
            admin_district,
          } as any,
          itemsTotal
        );
      } catch (feeError: any) {
        // Re-throw with proper error handling
        const err: any = new Error(feeError.message || 'Failed to calculate delivery fee');
        err.statusCode = feeError.statusCode || 400;
        throw err;
      }

      const deliveryFee = Number(deliveryFeeDetails.finalFee || 0);
      const discount = 0;
      const grandTotal = Math.max(0, itemsTotal + deliveryFee - discount);

      const addressSnapshot = {
        name: String(addr.name).trim(),
        phone: String(addr.phone).trim(),
        label: String(addr.label || "HOME").trim(),
        addressLine: String(addr.addressLine).trim(),
        city: String(addr.city).trim(),
        state: String(resolved.state).trim(),
        pincode: String(addr.pincode).trim(),
        postal_district,
        admin_district,
        lat: Number(addr.lat),
        lng: Number(addr.lng),
      };

      const orderStatus = OrderStatus.CREATED;
      const paymentStatus =
        paymentMethod === "upi" ? "AWAITING_UPI_APPROVAL" : ("PENDING" as any);

      const order = new Order({
        userId,
        idempotencyKey: idempotencyKey || undefined,
        items: orderItems,
        itemsTotal,
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

      console.log('📦 [OrderBuilder] Order object before save:', {
        distanceKm: order.distanceKm,
        coordsSource: order.coordsSource,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
      });

      try {
        if (useSession) {
          await order.save({ session: s! });
        } else {
          await order.save();
        }
      } catch (saveError: any) {
        console.error('❌ [OrderBuilder] Order save failed:', {
          error: saveError.message,
          validationErrors: saveError.errors,
        });
        throw saveError;
      }

      if (useSession) {
        const ttlMs = paymentMethod === "cod" ? 48 * 60 * 60_000 : 20 * 60_000;
        await inventoryReservationService.reserveForOrder({
          session: s!,
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
            { new: true, session: s! }
          );
        }
      } else {
        const err: any = new Error("Inventory reservation requires transactions (Mongo replica set)");
        err.statusCode = 500;
        throw err;
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
          useSession ? { session: s! } : undefined
        );
      } catch (e) {
        console.error("[OrderBuilder] failed to publish ORDER_CREATED", e);
      }

      return { order, created: true };
  };

  try {
    let result: CreateOrderFromCartResult;
    try {
      result = (await session.withTransaction(async () => run(session))) as CreateOrderFromCartResult;
    } catch (e: any) {
      if (isTxnUnsupportedError(e)) {
        result = await run(undefined);
      } else {
        throw e;
      }
    }

    return result;
  } catch (e: any) {
    if (e?.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ userId, idempotencyKey });
      if (existing) {
        return { order: existing, created: false };
      }
    }

    throw e;
  } finally {
    session.endSession();
  }
}
