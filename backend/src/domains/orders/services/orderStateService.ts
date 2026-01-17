import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { OrderEvent } from "../../../models/OrderEvent";
import { OrderStatus } from "../enums/OrderStatus";
import { inventoryService } from "./inventoryService";
import { inventoryReservationService } from "./inventoryReservationService";
import { publish } from "../../events/eventBus";
import { stableEventId } from "../../events/eventId";
import {
  createDeliveryAssignedEvent,
  createOrderCancelledEvent,
  createOrderConfirmedEvent,
  createOrderDeliveredEvent,
  createOrderFailedEvent,
  createOrderInTransitEvent,
  createOrderPackedEvent,
  createOrderPickedUpEvent,
} from "../../events/order.events";

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
  [OrderStatus.PACKED]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.PACKED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.OUT_FOR_DELIVERY]: [],
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
  session?: mongoose.ClientSession;
};

function normalizeOrderStatus(raw: any): OrderStatus | null {
  const v = String(raw || "").trim().toUpperCase();
  if (!v) return null;

  if (v === "PENDING" || v === "PENDING_PAYMENT") return OrderStatus.CREATED;

  if (v === OrderStatus.CREATED) return OrderStatus.CREATED;
  if (v === OrderStatus.CONFIRMED) return OrderStatus.CONFIRMED;
  if (v === OrderStatus.PACKED) return OrderStatus.PACKED;
  if (v === OrderStatus.ASSIGNED) return OrderStatus.ASSIGNED;
  if (v === OrderStatus.PICKED_UP) return OrderStatus.PICKED_UP;
  if (v === OrderStatus.IN_TRANSIT) return OrderStatus.IN_TRANSIT;
  if (v === OrderStatus.OUT_FOR_DELIVERY) return OrderStatus.IN_TRANSIT;
  if (v === OrderStatus.DELIVERED) return OrderStatus.DELIVERED;
  if (v === OrderStatus.FAILED) return OrderStatus.FAILED;
  if (v === OrderStatus.RETURNED) return OrderStatus.RETURNED;
  if (v === OrderStatus.CANCELLED) return OrderStatus.CANCELLED;

  // legacy values (best-effort, no new states)
  if (v === "CREATED") return OrderStatus.CREATED;
  if (v === "CONFIRMED") return OrderStatus.CONFIRMED;
  if (v === "DELIVERED") return OrderStatus.DELIVERED;
  if (v === "CANCELLED") return OrderStatus.CANCELLED;

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
      from === OrderStatus.CREATED;
    if (!canCancel) {
      throw new ForbiddenTransitionError(
        `Role CUSTOMER cannot transition ${from} -> ${to}`
      );
    }
    return;
  }

  if (actorRole === "DELIVERY_PARTNER") {
    const allowed =
      (from === OrderStatus.ASSIGNED && to === OrderStatus.PICKED_UP) ||
      (from === OrderStatus.PICKED_UP && to === OrderStatus.IN_TRANSIT) ||
      (from === OrderStatus.IN_TRANSIT &&
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
      (from === OrderStatus.PACKED && to === OrderStatus.ASSIGNED) ||
      (from === OrderStatus.ASSIGNED && to === OrderStatus.PACKED) ||
      (from === OrderStatus.FAILED && to === OrderStatus.RETURNED) ||
      (to === OrderStatus.CANCELLED &&
        (from === OrderStatus.CREATED ||
          from === OrderStatus.CONFIRMED ||
          from === OrderStatus.PACKED));

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
  | "pickedUpAt"
  | "inTransitAt"
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
    case OrderStatus.PICKED_UP:
      return "pickedUpAt";
    case OrderStatus.IN_TRANSIT:
      return "inTransitAt";
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
    const ownsSession = !input.session;
    const session = input.session || (await mongoose.startSession());

    try {
      let updatedOrder: any = null;
      let fromStatus: OrderStatus | null = null;
      let toStatus: OrderStatus | null = null;
      let transitionOccurredAt: string | null = null;

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const runOnce = async () => {
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

            fromStatus = fromCanonical;

            const to = input.toStatus;
            toStatus = to;

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

            if (input.actorRole === "DELIVERY_PARTNER") {
              const assignedPartnerId = (order as any).deliveryPartnerId;
              const assignedBoyId = (order as any).deliveryBoyId;
              const actorId = String(input.actorId);
              const matchesPartner = assignedPartnerId && String(assignedPartnerId) === actorId;
              const matchesBoy = assignedBoyId && String(assignedBoyId) === actorId;

              if (!matchesPartner && !matchesBoy) {
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
            transitionOccurredAt = now.toISOString();
            const meta: any = input.meta || {};

            if (fromCanonical === OrderStatus.IN_TRANSIT && to === OrderStatus.DELIVERED) {
              const providedOtp = String(meta?.otp || "").trim();
              if (!providedOtp) {
                throw new OtpVerificationError("OTP is required to complete delivery");
              }

              const expectedOtp = String((order as any).deliveryOtp || "").trim();
              const expiresAt = (order as any).deliveryOtpExpiresAt as Date | undefined;
              const issuedTo = (order as any).deliveryOtpIssuedTo;

              if (!expectedOtp || !expiresAt || !(expiresAt instanceof Date)) {
                throw new OtpVerificationError("Delivery OTP is not available");
              }

              if (expiresAt.getTime() <= Date.now()) {
                throw new OtpVerificationError("Delivery OTP expired");
              }

              if (issuedTo && String(issuedTo) !== String(input.actorId)) {
                throw new OtpVerificationError("Delivery OTP is not issued for this delivery partner");
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
                deliveredBy: mongoose.Types.ObjectId.isValid(String(input.actorId))
                  ? new mongoose.Types.ObjectId(String(input.actorId))
                  : undefined,
              };
            }

            if (fromCanonical === OrderStatus.IN_TRANSIT && to === OrderStatus.FAILED) {
              (order as any).failureReasonCode = meta?.failureReasonCode;
              (order as any).failureNotes = meta?.failureNotes;
            }

            if (fromCanonical === OrderStatus.FAILED && to === OrderStatus.RETURNED) {
              (order as any).returnReason = meta?.returnReason;
            }

            if (to === OrderStatus.IN_TRANSIT) {
              const incoming = (meta as any)?.estimatedDeliveryWindow;
              const hasIncoming = incoming?.start && incoming?.end;

              if (hasIncoming) {
                (order as any).estimatedDeliveryWindow = {
                  start: new Date(incoming.start),
                  end: new Date(incoming.end),
                  confidence: incoming?.confidence === "high" ? "high" : "medium",
                };
              } else if (!(order as any).estimatedDeliveryWindow?.start || !(order as any).estimatedDeliveryWindow?.end) {
                const distanceKm = Number((order as any).distanceKm);
                const confidence = Number.isFinite(distanceKm) && distanceKm > 0 && distanceKm <= 5 ? "high" : "medium";
                const startMinutes = confidence === "high" ? 30 : 60;
                const endMinutes = confidence === "high" ? 90 : 150;

                (order as any).estimatedDeliveryWindow = {
                  start: new Date(now.getTime() + startMinutes * 60 * 1000),
                  end: new Date(now.getTime() + endMinutes * 60 * 1000),
                  confidence,
                };
              }
            }

            (order as any).orderStatus = to as any;

            const tsField = getTimestampField(to);
            if (tsField) {
              (order as any)[tsField] = now;
            }

            let inventoryRestored = false;
            if (
              to === OrderStatus.CANCELLED &&
              (fromCanonical === OrderStatus.CREATED || fromCanonical === OrderStatus.CONFIRMED)
            ) {
              await inventoryReservationService.releaseActiveReservationsForOrder({
                session,
                orderId: (order as any)._id,
              });

              const result = await inventoryReservationService.restoreCommittedReservationsOnce({
                session,
                orderId: (order as any)._id,
                reason: "CANCELLED",
              });
              inventoryRestored = result.restored;
            }

            if (to === OrderStatus.FAILED && fromCanonical === OrderStatus.IN_TRANSIT) {
              await inventoryReservationService.releaseActiveReservationsForOrder({
                session,
                orderId: (order as any)._id,
              });
            }

            if (to === OrderStatus.RETURNED && fromCanonical === OrderStatus.FAILED) {
              await inventoryReservationService.releaseActiveReservationsForOrder({
                session,
                orderId: (order as any)._id,
              });

              const result = await inventoryReservationService.restoreCommittedReservationsOnce({
                session,
                orderId: (order as any)._id,
                reason: "RETURNED",
              });
              inventoryRestored = result.restored;
            }

            (order as any).history = (order as any).history || [];
            (order as any).history.push({
              from: fromCanonical,
              to,
              actorRole: input.actorRole,
              actorId: input.actorId,
              at: now,
              meta: input.meta,
            });

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
          };

          if (ownsSession) {
            await session.withTransaction(runOnce);
          } else {
            await runOnce();
          }

          break;
        } catch (e: any) {
          if (ownsSession && attempt < maxAttempts && isTransientTransactionError(e)) {
            continue;
          }
          throw e;
        }
      }

      try {
        const userId = updatedOrder?.userId ? String(updatedOrder.userId) : "";
        const orderId = updatedOrder?._id ? String(updatedOrder._id) : "";
        if (userId && orderId && toStatus) {
          const items = Array.isArray((updatedOrder as any)?.items) ? (updatedOrder as any).items : [];
          const itemCount = items.reduce(
            (sum: number, it: any) => sum + Number(it?.qty ?? it?.quantity ?? 0),
            0
          );
          const primaryProductName =
            typeof items?.[0]?.name === "string" && String(items[0].name).trim()
              ? String(items[0].name)
              : undefined;
          const totalAmount = Number(
            (updatedOrder as any)?.totalAmount ?? (updatedOrder as any)?.grandTotal ?? 0
          );

          const metaFromInput: any = (input as any)?.meta || {};
          const deliveryPartnerName =
            typeof metaFromInput?.deliveryPartnerName === "string" && metaFromInput.deliveryPartnerName.trim()
              ? String(metaFromInput.deliveryPartnerName)
              : undefined;

          const actorType =
            input.actorRole === "ADMIN"
              ? "admin"
              : input.actorRole === "DELIVERY_PARTNER"
              ? "delivery"
              : "user";

          const actorId = input.actorId ? String(input.actorId) : undefined;
          const actor = { type: actorType as any, ...(actorId ? { id: actorId } : {}) };
          const source = "orders";
          const occurredAt = transitionOccurredAt || new Date().toISOString();
          const eventId = stableEventId(`order:${orderId}:status:${String(toStatus)}`);

          const publishWithSession = async (evt: any) => {
            if (ownsSession) {
              await publish(evt);
              return;
            }

            await publish(evt, { session });
          };

          switch (toStatus) {
            case OrderStatus.CONFIRMED:
              await publishWithSession(
                createOrderConfirmedEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            case OrderStatus.PACKED:
              await publishWithSession(
                createOrderPackedEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            case OrderStatus.ASSIGNED:
              await publishWithSession(
                createDeliveryAssignedEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                  ...(deliveryPartnerName ? { deliveryPartnerName } : {}),
                })
              );
              break;
            case OrderStatus.PICKED_UP:
              await publishWithSession(
                createOrderPickedUpEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            case OrderStatus.IN_TRANSIT:
              await publishWithSession(
                createOrderInTransitEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            case OrderStatus.DELIVERED:
              await publishWithSession(
                createOrderDeliveredEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            case OrderStatus.FAILED:
              await publishWithSession(
                createOrderFailedEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            case OrderStatus.CANCELLED:
              await publishWithSession(
                createOrderCancelledEvent({
                  source,
                  actor,
                  eventId,
                  occurredAt,
                  userId,
                  orderId,
                  itemCount: Number.isFinite(itemCount) ? itemCount : undefined,
                  totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
                  primaryProductName,
                })
              );
              break;
            default:
              break;
          }
        }
      } catch (e) {
        console.error("[orderStateService] failed to publish event", e);
      }

      return updatedOrder;
    } finally {
      if (ownsSession) {
        session.endSession();
      }
    }
  },

  ALLOWED_TRANSITIONS,
};
