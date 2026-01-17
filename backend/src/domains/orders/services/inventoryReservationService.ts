import mongoose from "mongoose";
import { InventoryReservation } from "../../../models/InventoryReservation";
import { Product } from "../../../models/Product";
import { InventoryAdjustment, InventoryAdjustmentReason } from "../../../models/InventoryAdjustment";

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
        throw new InventoryReservationConflictError("Insufficient stock");
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

      await Product.updateOne(
        { _id: (r as any).productId },
        { $inc: { stock: -qty, reservedStock: -qty } },
        { session }
      );
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
      await Product.updateOne(
        { _id: (r as any).productId },
        { $inc: { reservedStock: -qty } },
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
