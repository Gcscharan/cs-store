import mongoose from "mongoose";
import { InventoryAdjustment, InventoryAdjustmentReason } from "../../../models/InventoryAdjustment";
import { Product } from "../../../models/Product";

export class InventoryRestoreConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "InventoryRestoreConflictError";
  }
}

function isDuplicateKeyError(err: any): boolean {
  return err && (err.code === 11000 || err.code === 11001);
}

export const inventoryService = {
  async restoreOnce(params: {
    session: mongoose.ClientSession;
    orderId: mongoose.Types.ObjectId;
    reason: InventoryAdjustmentReason;
    items: Array<{ productId: mongoose.Types.ObjectId; qty: number }>;
  }): Promise<{ restored: boolean }> {
    const { session, orderId, reason, items } = params;
    const uniqueKey = `${String(orderId)}:${reason}`;

    try {
      await InventoryAdjustment.create(
        [
          {
            orderId,
            reason,
            type: "RESTORE",
            uniqueKey,
            items: items.map((it) => ({
              productId: it.productId,
              qty: Number(it.qty),
            })),
          },
        ],
        { session }
      );
    } catch (e: any) {
      if (isDuplicateKeyError(e)) {
        return { restored: false };
      }
      throw e;
    }

    for (const it of items) {
      const qty = Number(it.qty);
      if (!it.productId || !Number.isFinite(qty) || qty <= 0) {
        throw new InventoryRestoreConflictError("Invalid inventory restore item");
      }

      const updated = await Product.findByIdAndUpdate(
        it.productId,
        { $inc: { stock: qty } },
        { new: true, session }
      );

      if (!updated) {
        throw new InventoryRestoreConflictError("Product not found during inventory restore");
      }
    }

    return { restored: true };
  },
};
