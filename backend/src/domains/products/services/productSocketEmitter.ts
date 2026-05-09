import { v4 as uuidv4 } from "uuid";
import { Server } from "socket.io";
import { logger } from "../../../utils/logger";

export interface ProductEventPayload {
  product: any;
  eventId: string;
  timestamp: string;
}

export class ProductSocketEmitter {
  constructor(private io: Server) {}

  emitProductCreated(product: any): void {
    const payload: ProductEventPayload = {
      product,
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    this.io.to("admin_room").emit("product:created", payload);
    logger.info("[ProductSocketEmitter] product:created", { productId: String(product._id) });
  }

  emitProductUpdated(product: any): void {
    const payload: ProductEventPayload = {
      product,
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    this.io.to("admin_room").emit("product:updated", payload);
    logger.info("[ProductSocketEmitter] product:updated", { productId: String(product._id) });
  }

  emitProductDeleted(productId: string): void {
    const payload = {
      productId,
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    this.io.to("admin_room").emit("product:deleted", payload);
    logger.info("[ProductSocketEmitter] product:deleted", { productId });
  }
}
