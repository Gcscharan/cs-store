import os from "os";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { InventoryReservation } from "../../../models/InventoryReservation";
import { Product } from "../../../models/Product";

let started = false;

export function initializeInventoryReservationSweeper(params?: {
  pollIntervalMs?: number;
  batchSize?: number;
}): void {
  if (started) return;
  started = true;

  const pollIntervalMs = Number(params?.pollIntervalMs || 30_000);
  const batchSize = Number(params?.batchSize || 50);
  const workerId = `${os.hostname()}:${process.pid}:${randomUUID()}`;

  const tick = async () => {
    const now = new Date();

    const expired = await InventoryReservation.find({
      status: "ACTIVE",
      expiresAt: { $lte: now },
    })
      .sort({ expiresAt: 1 })
      .limit(batchSize)
      .lean();

    if (expired.length === 0) return;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const r of expired) {
          const res = await InventoryReservation.updateOne(
            { _id: (r as any)._id, status: "ACTIVE" },
            { $set: { status: "EXPIRED", releasedAt: new Date() } },
            { session }
          );

          if ((res as any).modifiedCount !== 1) {
            continue;
          }

          await Product.updateOne(
            { _id: (r as any).productId },
            { $inc: { reservedStock: -Number((r as any).qty) } },
            { session }
          );
        }
      });
    } finally {
      session.endSession();
    }
  };

  setInterval(() => {
    void tick().catch(() => undefined);
  }, pollIntervalMs);

  void tick().catch(() => undefined);
}
