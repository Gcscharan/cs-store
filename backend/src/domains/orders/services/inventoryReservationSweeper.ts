import { logger } from '../../../utils/logger';
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

  let consecutiveFailures = 0;
  const FAILURE_THRESHOLD = 10;

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

          const qty = Math.max(0, Number((r as any).qty) || 0);
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
      });
    } finally {
      session.endSession();
    }
  };

  const safeTick = async () => {
    try {
      await tick();
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      logger.error("[INVENTORY_SWEEPER_ERROR]", err);
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        logger.error("[INVENTORY_SWEEPER_FATAL] Too many consecutive failures. Crashing.");
        process.exit(1);
      }
    }
  };

  setInterval(() => {
    void safeTick();
  }, pollIntervalMs);

  void safeTick();
}
