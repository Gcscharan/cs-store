import { Order } from "../../../models/Order";
import { autoAssignmentService } from "./autoAssignmentService";
import { assignPackedOrderToDeliveryBoy } from "../../../controllers/orderAssignmentController";

type EnqueueInput = {
  orderId: string;
  actorId: string;
  attempt?: number;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000;

export async function enqueueAutoAssignment(input: EnqueueInput): Promise<void> {
  const attempt = Number(input.attempt || 1);

  const order = await Order.findById(input.orderId)
    .select("orderStatus deliveryBoyId")
    .lean();

  if (!order) return;

  const orderStatusUpper = String((order as any).orderStatus || "").toUpperCase();
  if (orderStatusUpper !== "PACKED") return;

  if ((order as any).deliveryBoyId) return;

  const ranked = await autoAssignmentService.rankCandidatesForOrder(input.orderId);
  if (ranked.length === 0) {
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(() => {
        void enqueueAutoAssignment({ ...input, attempt: attempt + 1 }).catch(() => undefined);
      }, RETRY_DELAY_MS);
    }
    return;
  }

  for (const candidate of ranked) {
    try {
      await assignPackedOrderToDeliveryBoy({
        orderId: input.orderId,
        deliveryBoyId: candidate.deliveryBoyId,
        actorId: input.actorId,
      });
      return;
    } catch (e: any) {
      const statusCode = Number(e?.statusCode) || 500;
      if (statusCode === 409) {
        continue;
      }
      if (statusCode === 400 || statusCode === 403 || statusCode === 404) {
        continue;
      }
      break;
    }
  }

  if (attempt < MAX_ATTEMPTS) {
    setTimeout(() => {
      void enqueueAutoAssignment({ ...input, attempt: attempt + 1 }).catch(() => undefined);
    }, RETRY_DELAY_MS);
  }
}
