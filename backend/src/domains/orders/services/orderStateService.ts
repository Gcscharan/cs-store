import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { OrderEvent } from "../../../models/OrderEvent";
import { OrderStatus } from "../enums/OrderStatus";
import { inventoryService } from "./inventoryService";

export type OrderActorRole = "CUSTOMER" | "DELIVERY_PARTNER" | "ADMIN";

export class InvalidStateTransitionError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "InvalidStateTransitionError";
  }
}

export class ForbiddenTransitionError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenTransitionError";
  }
}

export class OtpVerificationError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "OtpVerificationError";
  }
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.FAILED]: [OrderStatus.RETURNED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
};

type TransitionInput = {
  orderId: string;
  toStatus: OrderStatus;
  actorRole: OrderActorRole;
  actorId: string;
  meta?: unknown;
};

function normalizeOrderStatus(raw: any): OrderStatus | null {
  const v = String(raw || "").trim();
  if (!v) return null;

  if (v === OrderStatus.CREATED) return OrderStatus.CREATED;
  if (v === OrderStatus.CONFIRMED) return OrderStatus.CONFIRMED;
  if (v === OrderStatus.PACKED) return OrderStatus.PACKED;
  if (v === OrderStatus.OUT_FOR_DELIVERY) return OrderStatus.OUT_FOR_DELIVERY;
  if (v === OrderStatus.DELIVERED) return OrderStatus.DELIVERED;
  if (v === OrderStatus.FAILED) return OrderStatus.FAILED;
  if (v === OrderStatus.RETURNED) return OrderStatus.RETURNED;
  if (v === OrderStatus.CANCELLED) return OrderStatus.CANCELLED;

  // legacy values (best-effort, no new states)
  if (v === "pending" || v === "created") return OrderStatus.CREATED;
  if (v === "confirmed") return OrderStatus.CONFIRMED;
  if (v === "delivered") return OrderStatus.DELIVERED;
  if (v === "cancelled") return OrderStatus.CANCELLED;

  return null;
}

function isTransientTransactionError(err: any): boolean {
  const labels: string[] = Array.isArray(err?.errorLabels) ? err.errorLabels : [];
  if (labels.includes("TransientTransactionError")) return true;
  if (labels.includes("UnknownTransactionCommitResult")) return true;

  const msg = String(err?.message || "");
  if (msg.includes("WriteConflict")) return true;
  if (msg.includes("write conflict")) return true;
  return false;
}

function assertAllowedByState(from: OrderStatus, to: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError(
      `Invalid state transition: ${from} -> ${to}`
    );
  }
}

function assertAllowedByRole(params: {
  from: OrderStatus;
  to: OrderStatus;
  actorRole: OrderActorRole;
}): void {
  const { from, to, actorRole } = params;

  if (actorRole === "CUSTOMER") {
    const canCancel =
      to === OrderStatus.CANCELLED &&
      (from === OrderStatus.CREATED || from === OrderStatus.CONFIRMED);
    if (!canCancel) {
      throw new ForbiddenTransitionError(
        `Role CUSTOMER cannot transition ${from} -> ${to}`
      );
    }
    return;
  }

  if (actorRole === "DELIVERY_PARTNER") {
    const allowed =
      (from === OrderStatus.PACKED && to === OrderStatus.OUT_FOR_DELIVERY) ||
      (from === OrderStatus.OUT_FOR_DELIVERY &&
        (to === OrderStatus.DELIVERED || to === OrderStatus.FAILED));
    if (!allowed) {
      throw new ForbiddenTransitionError(
        `Role DELIVERY_PARTNER cannot transition ${from} -> ${to}`
      );
    }
    return;
  }

  if (actorRole === "ADMIN") {
    const allowed =
      (from === OrderStatus.CREATED && to === OrderStatus.CONFIRMED) ||
      (from === OrderStatus.CONFIRMED && to === OrderStatus.PACKED) ||
      (from === OrderStatus.FAILED && to === OrderStatus.RETURNED) ||
      (to === OrderStatus.CANCELLED &&
        (from === OrderStatus.CREATED || from === OrderStatus.CONFIRMED));

    if (!allowed) {
      throw new ForbiddenTransitionError(`Role ADMIN cannot transition ${from} -> ${to}`);
    }
    return;
  }

  throw new ForbiddenTransitionError(`Unknown actorRole: ${String(actorRole)}`);
}

function getTimestampField(to: OrderStatus):
  | "confirmedAt"
  | "packedAt"
  | "outForDeliveryAt"
  | "deliveredAt"
  | "failedAt"
  | "returnedAt"
  | "cancelledAt"
  | null {
  switch (to) {
    case OrderStatus.CONFIRMED:
      return "confirmedAt";
    case OrderStatus.PACKED:
      return "packedAt";
    case OrderStatus.OUT_FOR_DELIVERY:
      return "outForDeliveryAt";
    case OrderStatus.DELIVERED:
      return "deliveredAt";
    case OrderStatus.FAILED:
      return "failedAt";
    case OrderStatus.RETURNED:
      return "returnedAt";
    case OrderStatus.CANCELLED:
      return "cancelledAt";
    default:
      return null;
  }
}

export const orderStateService = {
  async transition(input: TransitionInput) {
    const session = await mongoose.startSession();

    try {
      let updatedOrder: any = null;

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await session.withTransaction(async () => {
            const order = await Order.findById(input.orderId).session(session);
            if (!order) {
              const err: any = new Error("Order not found");
              err.statusCode = 404;
              throw err;
            }

            const fromCanonical = normalizeOrderStatus((order as any).orderStatus);
            if (!fromCanonical) {
              throw new InvalidStateTransitionError(
                `Unknown orderStatus: ${String((order as any).orderStatus)}`
              );
            }

            const to = input.toStatus;

            // Idempotency (including legacy casing)
            if (fromCanonical === to) {
              updatedOrder = order;
              return;
            }

            assertAllowedByState(fromCanonical, to);
            assertAllowedByRole({
              from: fromCanonical,
              to,
              actorRole: input.actorRole,
            });

            // Ownership enforcement
            if (input.actorRole === "DELIVERY_PARTNER") {
              const assigned = (order as any).deliveryPartnerId || (order as any).deliveryBoyId;
              if (!assigned || String(assigned) !== String(input.actorId)) {
                throw new ForbiddenTransitionError(
                  "Delivery partner is not assigned to this order"
                );
              }
            }

            if (input.actorRole === "CUSTOMER") {
              if (String((order as any).userId) !== String(input.actorId)) {
                throw new ForbiddenTransitionError(
                  "Customer is not allowed to modify this order"
                );
              }
            }

            const now = new Date();
            const meta: any = input.meta || {};

            // OTP enforcement for prepaid deliveries
            if (fromCanonical === OrderStatus.OUT_FOR_DELIVERY && to === OrderStatus.DELIVERED) {
              const paymentMethod = String((order as any).paymentMethod || "").toLowerCase();
              const paymentStatus = String((order as any).paymentStatus || "").toUpperCase();
              const isPrepaid = paymentMethod === "upi" || paymentStatus === "PAID";

              if (isPrepaid) {
                const providedOtp = String(meta?.otp || "").trim();
                if (!providedOtp) {
                  throw new OtpVerificationError("OTP is required to complete delivery");
                }

                const expectedOtp = String((order as any).deliveryOtp || "").trim();
                const expiresAt = (order as any).deliveryOtpExpiresAt as Date | undefined;

                if (!expectedOtp || !expiresAt || !(expiresAt instanceof Date)) {
                  throw new OtpVerificationError("Delivery OTP is not available");
                }

                if (expiresAt.getTime() <= Date.now()) {
                  throw new OtpVerificationError("Delivery OTP expired");
                }

                if (providedOtp !== expectedOtp) {
                  throw new OtpVerificationError("Invalid delivery OTP");
                }

                (order as any).deliveryProof = {
                  type: "otp",
                  verifiedAt: now,
                  otpVerifiedAt: now,
                  photoUrl: meta?.photoUrl,
                  signature: meta?.signature,
                  geo: meta?.geo,
                  deviceId: meta?.deviceId,
                };
              }
            }

            if (fromCanonical === OrderStatus.OUT_FOR_DELIVERY && to === OrderStatus.FAILED) {
              (order as any).failureReasonCode = meta?.failureReasonCode;
              (order as any).failureNotes = meta?.failureNotes;
            }

            if (fromCanonical === OrderStatus.FAILED && to === OrderStatus.RETURNED) {
              (order as any).returnReason = meta?.returnReason;
            }

            // Mutate status (ONLY here)
            (order as any).orderStatus = to as any;

            const tsField = getTimestampField(to);
            if (tsField) {
              (order as any)[tsField] = now;
            }

            // Inventory restoration (exactly-once, transactional)
            let inventoryRestored = false;
            if (
              to === OrderStatus.CANCELLED &&
              (fromCanonical === OrderStatus.CREATED || fromCanonical === OrderStatus.CONFIRMED)
            ) {
              const items = ((order as any).items || []) as any[];
              const restoreItems = items
                .map((it) => ({
                  productId: it.productId,
                  qty: Number(it.qty ?? it.quantity ?? 0),
                }))
                .filter((it) => it.productId && Number.isFinite(it.qty) && it.qty > 0);

              const result = await inventoryService.restoreOnce({
                session,
                orderId: (order as any)._id,
                reason: "CANCELLED",
                items: restoreItems,
              });
              inventoryRestored = result.restored;
            }

            if (to === OrderStatus.RETURNED && fromCanonical === OrderStatus.FAILED) {
              const items = ((order as any).items || []) as any[];
              const restoreItems = items
                .map((it) => ({
                  productId: it.productId,
                  qty: Number(it.qty ?? it.quantity ?? 0),
                }))
                .filter((it) => it.productId && Number.isFinite(it.qty) && it.qty > 0);

              const result = await inventoryService.restoreOnce({
                session,
                orderId: (order as any)._id,
                reason: "RETURNED",
                items: restoreItems,
              });
              inventoryRestored = result.restored;
            }

            // Append history
            (order as any).history = (order as any).history || [];
            (order as any).history.push({
              from: fromCanonical,
              to,
              actorRole: input.actorRole,
              actorId: input.actorId,
              at: now,
              meta: input.meta,
            });

            // Outbox event insert (same transaction)
            await OrderEvent.create(
              [
                {
                  orderId: (order as any)._id,
                  type: "ORDER_STATUS_CHANGED",
                  payload: {
                    from: fromCanonical,
                    to,
                    actorRole: input.actorRole,
                    actorId: input.actorId,
                    inventoryRestored,
                    meta: input.meta,
                  },
                },
              ],
              { session }
            );

            await order.save({ session });
            updatedOrder = order;
          });

          break;
        } catch (e: any) {
          if (attempt < maxAttempts && isTransientTransactionError(e)) {
            continue;
          }
          throw e;
        }
      }

      return updatedOrder;
    } finally {
      session.endSession();
    }
  },

  ALLOWED_TRANSITIONS,
};
