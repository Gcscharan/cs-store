import mongoose from "mongoose";
import { InventoryReservation } from "../../../models/InventoryReservation";
import { Product } from "../../../models/Product";
import { InventoryAdjustment, InventoryAdjustmentReason } from "../../../models/InventoryAdjustment";
import { captureInventoryError } from "../../../utils/logger";

export class InventoryReservationConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "InventoryReservationConflictError";
  }
}

function isDuplicateKeyError(err: any): boolean {
  return err && (err.code === 11000 || err.code === 11001);
}

function normalizeQty(qty: any): number {
  const n = Number(qty);
  return Number.isFinite(n) ? n : 0;
}

export const inventoryReservationService = {
  async reserveForOrder(params: {
    session: mongoose.ClientSession;
    orderId: mongoose.Types.ObjectId;
    items: Array<{ productId: mongoose.Types.ObjectId; qty: number }>;
    ttlMs?: number;
  }): Promise<{ reserved: boolean }> {
    const { session, orderId, items, ttlMs } = params;
    const now = new Date();
    const expiresAt = new Date(Date.now() + Number(ttlMs || 15 * 60_000));

    for (const it of items) {
      const qty = normalizeQty(it.qty);
      if (!it.productId || qty <= 0) {
        throw new InventoryReservationConflictError("Invalid reservation item");
      }

      // Idempotency + retry safety:
      // - If a reservation already exists for (orderId, productId) and is ACTIVE/COMMITTED, do nothing.
      // - If it exists but was RELEASED/EXPIRED (e.g. payment failure or timeout), re-activate it and
      //   atomically re-increment reservedStock (with the same stock guard) inside the current txn.

      const upsertRes = await InventoryReservation.updateOne(
        { orderId, productId: it.productId },
        {
          $setOnInsert: {
            orderId,
            productId: it.productId,
            qty,
            status: "ACTIVE",
            expiresAt,
          },
        },
        { upsert: true, session }
      );

      const inserted = !!(upsertRes as any).upsertedId;
      if (!inserted) {
        // Reservation exists. If it's RELEASED/EXPIRED, we may re-activate it for a new payment attempt.
        const existing = await InventoryReservation.findOne({ orderId, productId: it.productId })
          .select("_id status qty")
          .session(session)
          .lean();

        const st = String((existing as any)?.status || "").toUpperCase();
        if (st === "ACTIVE" || st === "COMMITTED") {
          if (st === "ACTIVE") {
            // Refresh TTL for in-flight checkout attempts without changing reservedStock.
            await InventoryReservation.updateOne(
              { _id: (existing as any)._id, status: "ACTIVE" },
              { $set: { expiresAt, qty } },
              { session }
            );
          }
          continue;
        }

        if (st === "RELEASED" || st === "EXPIRED") {
          // Only one concurrent reactivation should win.
          const reactivate = await InventoryReservation.updateOne(
            { _id: (existing as any)._id, status: { $in: ["RELEASED", "EXPIRED"] } },
            { $set: { status: "ACTIVE", expiresAt, qty } },
            { session }
          );

          if (Number((reactivate as any).modifiedCount) !== 1) {
            // Another worker reactivated concurrently.
            continue;
          }

          const updated = await Product.findOneAndUpdate(
            {
              _id: it.productId,
              $expr: {
                $gte: [{ $subtract: ["$stock", { $ifNull: ["$reservedStock", 0] }] }, qty],
              },
            },
            { $inc: { reservedStock: qty } },
            { new: true, session }
          );

          if (!updated) {
            // Roll back reservation state to RELEASED so future attempts can retry cleanly.
            await InventoryReservation.updateOne(
              { _id: (existing as any)._id, status: "ACTIVE" },
              { $set: { status: "RELEASED", releasedAt: now } },
              { session }
            );
            throw new InventoryReservationConflictError("Insufficient stock");
          }

          continue;
        }

        // Unknown state: do not mutate.
        continue;
      }

      const updated = await Product.findOneAndUpdate(
        {
          _id: it.productId,
          $expr: {
            $gte: [{ $subtract: ["$stock", { $ifNull: ["$reservedStock", 0] }] }, qty],
          },
        },
        { $inc: { reservedStock: qty } },
        { new: true, session }
      );

      if (!updated) {
        await InventoryReservation.deleteOne(
          { orderId, productId: it.productId, status: "ACTIVE" },
          { session }
        );
        const err = new InventoryReservationConflictError("Insufficient stock");
        captureInventoryError("Insufficient stock for reservation", err, {
          orderId: String(orderId),
          productId: String(it.productId),
          qty,
        });
        throw err;
      }
    }

    return { reserved: true };
  },

  async commitReservationsForOrder(params: {
    session: mongoose.ClientSession;
    orderId: mongoose.Types.ObjectId;
  }): Promise<{ committed: boolean }> {
    const { session, orderId } = params;

    const reservations = await InventoryReservation.find({ orderId, status: "ACTIVE" })
      .select("_id productId qty")
      .session(session)
      .lean();

    if (reservations.length === 0) {
      return { committed: false };
    }

    const now = new Date();

    for (const r of reservations) {
      const qty = normalizeQty((r as any).qty);
      const changed = await InventoryReservation.updateOne(
        { _id: (r as any)._id, status: "ACTIVE" },
        { $set: { status: "COMMITTED", committedAt: now } },
        { session }
      );

      if (Number((changed as any).modifiedCount) !== 1) {
        continue;
      }

      // Commit must be safe under retries and never drive stock/reservedStock negative.
      // If the product update fails, roll reservation back to ACTIVE so a later attempt can retry.
      const updated = await Product.updateOne(
        {
          _id: (r as any).productId,
          $expr: {
            $and: [
              { $gte: ["$stock", qty] },
              { $gte: [{ $ifNull: ["$reservedStock", 0] }, qty] },
            ],
          },
        },
        { $inc: { stock: -qty, reservedStock: -qty } },
        { session }
      );

      if (Number((updated as any).modifiedCount) !== 1) {
        await InventoryReservation.updateOne(
          { _id: (r as any)._id, status: "COMMITTED" },
          { $set: { status: "ACTIVE" }, $unset: { committedAt: "" } },
          { session }
        );
        throw new InventoryReservationConflictError("Failed to commit inventory");
      }
    }

    return { committed: true };
  },

  async releaseActiveReservationsForOrder(params: {
    session: mongoose.ClientSession;
    orderId: mongoose.Types.ObjectId;
  }): Promise<{ released: boolean }> {
    const { session, orderId } = params;

    const reservations = await InventoryReservation.find({ orderId, status: "ACTIVE" })
      .select("_id productId qty")
      .session(session)
      .lean();

    if (reservations.length === 0) return { released: false };

    const now = new Date();

    for (const r of reservations) {
      const changed = await InventoryReservation.updateOne(
        { _id: (r as any)._id, status: "ACTIVE" },
        { $set: { status: "RELEASED", releasedAt: now } },
        { session }
      );

      if (Number((changed as any).modifiedCount) !== 1) {
        continue;
      }

      const qty = normalizeQty((r as any).qty);
      // DB-level safety: clamp reservedStock so it can never go below 0, even under retries
      // or concurrent releases/sweeper runs.
      await Product.updateOne(
        { _id: (r as any).productId },
        [
          {
            $set: {
              reservedStock: {
                $max: [
                  0,
                  {
                    $subtract: [
                      { $ifNull: ["$reservedStock", 0] },
                      qty,
                    ],
                  },
                ],
              },
            },
          },
        ] as any,
        { session }
      );
    }

    return { released: true };
  },

  async restoreCommittedReservationsOnce(params: {
    session: mongoose.ClientSession;
    orderId: mongoose.Types.ObjectId;
    reason: InventoryAdjustmentReason;
  }): Promise<{ restored: boolean }> {
    const { session, orderId, reason } = params;

    const committed = await InventoryReservation.find({ orderId, status: "COMMITTED" })
      .select("productId qty")
      .session(session)
      .lean();

    if (committed.length === 0) {
      return { restored: false };
    }

    const uniqueKey = `${String(orderId)}:${reason}`;

    try {
      await InventoryAdjustment.create(
        [
          {
            orderId,
            reason,
            type: "RESTORE",
            uniqueKey,
            items: committed.map((r: any) => ({
              productId: r.productId,
              qty: Number(r.qty),
            })),
          },
        ],
        { session }
      );
    } catch (e: any) {
      if (isDuplicateKeyError(e)) {
        await InventoryReservation.updateMany(
          { orderId, status: "COMMITTED" },
          { $set: { status: "RELEASED", releasedAt: new Date() } },
          { session }
        );
        return { restored: false };
      }
      throw e;
    }

    for (const r of committed) {
      const qty = normalizeQty((r as any).qty);
      await Product.updateOne(
        { _id: (r as any).productId },
        { $inc: { stock: qty } },
        { session }
      );
    }

    await InventoryReservation.updateMany(
      { orderId, status: "COMMITTED" },
      { $set: { status: "RELEASED", releasedAt: new Date() } },
      { session }
    );

    return { restored: true };
  },
};
