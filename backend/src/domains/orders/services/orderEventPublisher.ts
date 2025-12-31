import mongoose from "mongoose";
import { OrderEvent } from "../../../models/OrderEvent";

export async function publishPendingOrderEvents(params: {
  publish: (event: { orderId: string; type: string; payload: any }) => Promise<void>;
  batchSize?: number;
}) {
  const { publish, batchSize = 50 } = params;

  const session = await mongoose.startSession();
  try {
    const events = await OrderEvent.find({ publishedAt: { $exists: false } })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .lean();

    for (const ev of events) {
      await publish({
        orderId: String((ev as any).orderId),
        type: String((ev as any).type),
        payload: (ev as any).payload,
      });

      await session.withTransaction(async () => {
        await OrderEvent.updateOne(
          { _id: (ev as any)._id, publishedAt: { $exists: false } },
          { $set: { publishedAt: new Date() } },
          { session }
        );
      });
    }
  } finally {
    session.endSession();
  }
}
