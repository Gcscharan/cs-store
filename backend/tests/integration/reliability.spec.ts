import mongoose from "mongoose";

import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { DeliveryBoy } from "../../src/models/DeliveryBoy";
import Notification from "../../src/models/Notification";
import ProcessedEvent from "../../src/models/ProcessedEvent";
import { OutboxEvent } from "../../src/models/OutboxEvent";
import { InventoryReservation } from "../../src/models/InventoryReservation";

import { inventoryReservationService } from "../../src/domains/orders/services/inventoryReservationService";
import { initializeInventoryReservationSweeper } from "../../src/domains/orders/services/inventoryReservationSweeper";

import { assignPackedOrderToDeliveryBoy, unassignDeliveryBoyFromOrder } from "../../src/controllers/orderAssignmentController";
import { OrderStatus } from "../../src/domains/orders/enums/OrderStatus";
import { orderStateService } from "../../src/domains/orders/services/orderStateService";

import { createOrderConfirmedEvent } from "../../src/domains/events/order.events";
import { publish } from "../../src/domains/events/eventBus";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const intervalIds: any[] = [];
let originalSetInterval: any;

async function snapshotProduct(productId: string) {
  const p = await Product.findById(productId).lean();
  return {
    stock: Number((p as any)?.stock ?? 0),
    reservedStock: Number((p as any)?.reservedStock ?? 0),
  };
}

async function assertGlobalInvariants() {
  const products = await Product.find({}).select("stock reservedStock").lean();
  for (const p of products as any[]) {
    expect(Number(p.stock)).toBeGreaterThanOrEqual(0);
    expect(Number(p.reservedStock || 0)).toBeGreaterThanOrEqual(0);

    const committedQty = await InventoryReservation.aggregate([
      { $match: { productId: (p as any)._id, status: "COMMITTED" } },
      { $group: { _id: "$productId", qty: { $sum: "$qty" } } },
    ]);
    const committed = committedQty.length ? Number(committedQty[0].qty || 0) : 0;
    expect(Number(p.reservedStock || 0)).toBeLessThanOrEqual(Number(p.stock) + committed);
  }

  const deliveryBoys = await DeliveryBoy.find({}).select("currentLoad").lean();
  for (const d of deliveryBoys as any[]) {
    expect(Number(d.currentLoad || 0)).toBeGreaterThanOrEqual(0);
  }

  const unread = await Notification.countDocuments({ isRead: false });
  expect(unread).toBeGreaterThanOrEqual(0);
}

beforeAll(async () => {
  // Track long-running intervals so Jest can exit cleanly.
  originalSetInterval = global.setInterval;
  (global as any).setInterval = (...args: any[]) => {
    const id = originalSetInterval(...args);
    intervalIds.push(id);
    return id;
  };

  // Speed up reservation expiry handling for tests
  initializeInventoryReservationSweeper({ pollIntervalMs: 25, batchSize: 50 });
});

afterAll(async () => {
  for (const id of intervalIds) {
    try {
      clearInterval(id);
    } catch {
      // ignore
    }
  }
  if (originalSetInterval) {
    (global as any).setInterval = originalSetInterval;
  }
});

describe("Distributed reliability verification", () => {
  test("Inventory A: two users concurrently reserve last item -> only one succeeds", async () => {
    const product = await (global as any).createTestProduct({ stock: 1, reservedStock: 0 });

    const user1 = await (global as any).createTestUser({ email: "u1@example.com", phone: "9876543211" });
    const user2 = await (global as any).createTestUser({ email: "u2@example.com", phone: "9876543212" });

    const order1 = await Order.create({
      userId: user1._id,
      items: [{ productId: product._id, name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "upi",
      paymentStatus: "AWAITING_UPI_APPROVAL",
      orderStatus: "CREATED",
      deliveryStatus: "unassigned",
      address: {
        name: "U1",
        phone: "9876543211",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    const order2 = await Order.create({
      userId: user2._id,
      items: [{ productId: product._id, name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "upi",
      paymentStatus: "AWAITING_UPI_APPROVAL",
      orderStatus: "CREATED",
      deliveryStatus: "unassigned",
      address: {
        name: "U2",
        phone: "9876543212",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    const before = await snapshotProduct(String(product._id));

    const s1 = await mongoose.startSession();
    const s2 = await mongoose.startSession();

    const r1 = s1.withTransaction(async () =>
      inventoryReservationService.reserveForOrder({
        session: s1,
        orderId: order1._id,
        ttlMs: 60_000,
        items: [{ productId: product._id, qty: 1 }],
      })
    );

    const r2 = s2.withTransaction(async () =>
      inventoryReservationService.reserveForOrder({
        session: s2,
        orderId: order2._id,
        ttlMs: 60_000,
        items: [{ productId: product._id, qty: 1 }],
      })
    );

    const settled = await Promise.allSettled([r1, r2]);

    s1.endSession();
    s2.endSession();

    const after = await snapshotProduct(String(product._id));
    const reservations = await InventoryReservation.find({ productId: product._id, status: "ACTIVE" }).lean();

    const okCount = settled.filter((x) => x.status === "fulfilled").length;
    expect(okCount).toBe(1);
    expect(reservations.length).toBe(1);

    expect(before.stock).toBe(1);
    expect(after.stock).toBe(1);
    expect(after.reservedStock).toBe(1);

    await assertGlobalInvariants();
  });

  test("Inventory B: order created then crash before payment -> reservation expires and stock becomes available", async () => {
    const product = await (global as any).createTestProduct({ stock: 2, reservedStock: 0 });
    const user = await (global as any).createTestUser({ email: "u3@example.com", phone: "9876543213" });

    const order = await Order.create({
      userId: user._id,
      items: [{ productId: product._id, name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "upi",
      paymentStatus: "AWAITING_UPI_APPROVAL",
      orderStatus: "CREATED",
      deliveryStatus: "unassigned",
      address: {
        name: "U3",
        phone: "9876543213",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await inventoryReservationService.reserveForOrder({
          session,
          orderId: order._id,
          ttlMs: 50,
          items: [{ productId: product._id, qty: 1 }],
        });
      });
    } finally {
      session.endSession();
    }

    const mid = await snapshotProduct(String(product._id));
    expect(mid.reservedStock).toBe(1);

    // simulate time passing + background sweeper
    await wait(200);

    const after = await snapshotProduct(String(product._id));
    expect(after.reservedStock).toBe(0);

    const expired = await InventoryReservation.find({ orderId: order._id, status: "EXPIRED" }).lean();
    expect(expired.length).toBe(1);

    await assertGlobalInvariants();
  });

  test("Inventory C: payment success retried -> commit occurs only once", async () => {
    const product = await (global as any).createTestProduct({ stock: 1, reservedStock: 0 });
    const user = await (global as any).createTestUser({ email: "u4@example.com", phone: "9876543214" });

    const order = await Order.create({
      userId: user._id,
      items: [{ productId: product._id, name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "upi",
      paymentStatus: "AWAITING_UPI_APPROVAL",
      orderStatus: "CREATED",
      deliveryStatus: "unassigned",
      address: {
        name: "U4",
        phone: "9876543214",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    const s0 = await mongoose.startSession();
    try {
      await s0.withTransaction(async () => {
        await inventoryReservationService.reserveForOrder({
          session: s0,
          orderId: order._id,
          ttlMs: 60_000,
          items: [{ productId: product._id, qty: 1 }],
        });
      });
    } finally {
      s0.endSession();
    }

    const before = await snapshotProduct(String(product._id));
    expect(before.stock).toBe(1);
    expect(before.reservedStock).toBe(1);

    for (let i = 0; i < 3; i++) {
      const s = await mongoose.startSession();
      try {
        await s.withTransaction(async () => {
          await inventoryReservationService.commitReservationsForOrder({ session: s, orderId: order._id });
        });
      } finally {
        s.endSession();
      }
    }

    const after = await snapshotProduct(String(product._id));
    expect(after.stock).toBe(0);
    expect(after.reservedStock).toBe(0);

    const committed = await InventoryReservation.find({ orderId: order._id, status: "COMMITTED" }).lean();
    expect(committed.length).toBe(1);

    await assertGlobalInvariants();
  });

  test("Outbox A: crash after DB commit before dispatch -> restart delivers once", async () => {
    const user = await (global as any).createTestUser({ email: "u5@example.com", phone: "9876543215" });
    const orderId = new mongoose.Types.ObjectId().toString();

    // Phase 1: publish event while dispatcher/subscribers are effectively "down"
    await publish(
      createOrderConfirmedEvent({
        source: "qa",
        actor: { type: "user", id: String(user._id) },
        userId: String(user._id),
        orderId,
      })
    );

    const outboxPending = await OutboxEvent.find({}).lean();
    expect(outboxPending.length).toBe(1);
    expect(String((outboxPending[0] as any).status)).toBe("PENDING");

    // Phase 2: "restart" dispatcher + notification writer (no module reset; keep same mongoose instance)
    const { initializeNotificationWriter } = await import("../../src/domains/communication/services/notificationWriter");
    const { initializeOutboxDispatcher } = await import("../../src/domains/events/outboxDispatcher");
    initializeNotificationWriter();
    initializeOutboxDispatcher({ pollIntervalMs: 25, lockTtlMs: 200, maxAttempts: 5 });

    await wait(250);

    const notifications = await Notification.find({ userId: user._id }).lean();
    expect(notifications.length).toBe(1);

    const processed = await ProcessedEvent.find({}).lean();
    expect(processed.length).toBe(1);

    const outboxAfter = await OutboxEvent.find({}).lean();
    expect(String((outboxAfter[0] as any).status)).toBe("DISPATCHED");

    await assertGlobalInvariants();
  });

  test("Outbox B: notification writer throws -> outbox retries; NO duplicate notifications", async () => {
    const user = await (global as any).createTestUser({ email: "u6@example.com", phone: "9876543216" });
    const orderId = new mongoose.Types.ObjectId().toString();

    const { initializeNotificationWriter } = await import("../../src/domains/communication/services/notificationWriter");
    const { initializeOutboxDispatcher } = await import("../../src/domains/events/outboxDispatcher");
    initializeNotificationWriter();

    const NotificationModel = (await import("../../src/models/Notification")).default;
    const spy = jest
      .spyOn(NotificationModel, "create")
      .mockImplementationOnce(() => {
        throw new Error("Injected write failure");
      });

    initializeOutboxDispatcher({ pollIntervalMs: 25, lockTtlMs: 200, maxAttempts: 5 });

    await publish(
      createOrderConfirmedEvent({
        source: "qa",
        actor: { type: "user", id: String(user._id) },
        userId: String(user._id),
        orderId,
      })
    );

    // Allow first attempt to fail, then restore and wait for retry (backoff is exponential)
    await wait(200);
    spy.mockRestore();

    const start = Date.now();
    while (Date.now() - start < 8000) {
      const notifications = await Notification.find({ userId: user._id }).lean();
      const outbox = await OutboxEvent.find({}).lean();

      if (notifications.length === 1 && outbox.length === 1 && String((outbox[0] as any).status) === "DISPATCHED") {
        break;
      }

      await wait(150);
    }

    const notifications = await Notification.find({ userId: user._id }).lean();
    expect(notifications.length).toBe(1);

    const processed = await ProcessedEvent.find({}).lean();
    expect(processed.length).toBe(1);

    const outbox = await OutboxEvent.find({}).lean();
    expect(outbox.length).toBe(1);
    expect(String((outbox[0] as any).status)).toBe("DISPATCHED");

    await assertGlobalInvariants();
  });

  test("Assignment A: two workers assigning same PACKED order -> one succeeds, one conflicts; load increments once", async () => {
    const user = await (global as any).createTestUser({ email: "admin@example.com", phone: "9876543217", role: "admin" });

    const deliveryUser = await (global as any).createTestUser({ email: "driver@example.com", phone: "9876543218", role: "delivery", status: "active" });
    const deliveryBoy = await DeliveryBoy.create({
      name: "D",
      phone: "9876543218",
      userId: deliveryUser._id,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 1, lng: 1, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    const deliveryUser2 = await (global as any).createTestUser({ email: "driver_alt@example.com", phone: "9876543299", role: "delivery", status: "active" });
    const deliveryBoy2 = await DeliveryBoy.create({
      name: "D2",
      phone: "9876543299",
      userId: deliveryUser2._id,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 1, lng: 1, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    const customer = await (global as any).createTestUser({ email: "cust@example.com", phone: "9876543219" });
    const order = await Order.create({
      userId: customer._id,
      items: [{ productId: new mongoose.Types.ObjectId(), name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "cod",
      paymentStatus: "PENDING",
      orderStatus: "PACKED",
      deliveryStatus: "unassigned",
      address: {
        name: "C",
        phone: "9876543219",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    const p1 = assignPackedOrderToDeliveryBoy({ orderId: String(order._id), deliveryBoyId: String(deliveryBoy._id), actorId: String(user._id) });
    const p2 = assignPackedOrderToDeliveryBoy({ orderId: String(order._id), deliveryBoyId: String(deliveryBoy2._id), actorId: String(user._id) });

    const settled = await Promise.allSettled([p1, p2]);
    const ok = settled.filter((s) => s.status === "fulfilled").length;
    expect(ok).toBe(1);

    const updatedOrder = await Order.findById(order._id).lean();
    expect(String((updatedOrder as any).orderStatus || "").toUpperCase()).toBe("ASSIGNED");

    const updatedBoy1 = await DeliveryBoy.findById(deliveryBoy._id).lean();
    const updatedBoy2 = await DeliveryBoy.findById(deliveryBoy2._id).lean();
    const loads = [Number((updatedBoy1 as any).currentLoad || 0), Number((updatedBoy2 as any).currentLoad || 0)];
    expect(loads.includes(1)).toBe(true);
    expect(loads.reduce((a, b) => a + b, 0)).toBe(1);

    await assertGlobalInvariants();
  });

  test("Assignment B: admin unassign while auto-assign runs -> valid final state, no negative load", async () => {
    const admin = await (global as any).createTestUser({ email: "admin2@example.com", phone: "9876543220", role: "admin" });

    const dUser1 = await (global as any).createTestUser({ email: "driver2@example.com", phone: "9876543221", role: "delivery", status: "active" });
    const boy1 = await DeliveryBoy.create({
      name: "D1",
      phone: "9876543221",
      userId: dUser1._id,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 1, lng: 1, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    const dUser2 = await (global as any).createTestUser({ email: "driver3@example.com", phone: "9876543222", role: "delivery", status: "active" });
    const boy2 = await DeliveryBoy.create({
      name: "D2",
      phone: "9876543222",
      userId: dUser2._id,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 1, lng: 1, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    const customer = await (global as any).createTestUser({ email: "cust2@example.com", phone: "9876543223" });
    const order = await Order.create({
      userId: customer._id,
      items: [{ productId: new mongoose.Types.ObjectId(), name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "cod",
      paymentStatus: "PENDING",
      orderStatus: "PACKED",
      deliveryStatus: "unassigned",
      address: {
        name: "C",
        phone: "9876543223",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    await assignPackedOrderToDeliveryBoy({ orderId: String(order._id), deliveryBoyId: String(boy1._id), actorId: String(admin._id) });

    const req: any = { params: { orderId: String(order._id) }, user: { _id: admin._id, role: "admin" } };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      body: null as any,
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };

    const unassignPromise = unassignDeliveryBoyFromOrder(req, res);
    const autoAssignPromise = assignPackedOrderToDeliveryBoy({ orderId: String(order._id), deliveryBoyId: String(boy2._id), actorId: String(admin._id) });

    await Promise.allSettled([unassignPromise, autoAssignPromise]);

    const o = await Order.findById(order._id).lean();
    const statusUpper = String((o as any).orderStatus || "").toUpperCase();
    expect(["PACKED", "ASSIGNED"].includes(statusUpper)).toBe(true);

    const b1 = await DeliveryBoy.findById(boy1._id).lean();
    const b2 = await DeliveryBoy.findById(boy2._id).lean();
    expect(Number((b1 as any).currentLoad || 0)).toBeGreaterThanOrEqual(0);
    expect(Number((b2 as any).currentLoad || 0)).toBeGreaterThanOrEqual(0);

    await assertGlobalInvariants();
  });

  test("Chaos: payment success + cancel + assignment + failure (rapid) -> invariants hold", async () => {
    const product = await (global as any).createTestProduct({ stock: 1, reservedStock: 0 });
    const admin = await (global as any).createTestUser({ email: "admin3@example.com", phone: "9876543224", role: "admin" });

    const deliveryUser = await (global as any).createTestUser({ email: "driver4@example.com", phone: "9876543225", role: "delivery", status: "active" });
    const deliveryBoy = await DeliveryBoy.create({
      name: "DX",
      phone: "9876543225",
      userId: deliveryUser._id,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 1, lng: 1, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    const customer = await (global as any).createTestUser({ email: "cust3@example.com", phone: "9876543226" });

    const order = await Order.create({
      userId: customer._id,
      items: [{ productId: product._id, name: "P", price: 100, qty: 1 }],
      totalAmount: 100,
      paymentMethod: "upi",
      paymentStatus: "AWAITING_UPI_APPROVAL",
      orderStatus: "PACKED",
      deliveryStatus: "unassigned",
      address: {
        name: "C",
        phone: "9876543226",
        label: "Home",
        addressLine: "Addr",
        city: "C",
        state: "S",
        pincode: "500001",
        lat: 1,
        lng: 1,
      },
      assignmentHistory: [],
      history: [],
    });

    // Reserve inventory
    const s0 = await mongoose.startSession();
    try {
      await s0.withTransaction(async () => {
        await inventoryReservationService.reserveForOrder({
          session: s0,
          orderId: order._id,
          ttlMs: 60_000,
          items: [{ productId: product._id, qty: 1 }],
        });
      });
    } finally {
      s0.endSession();
    }

    const payCommit = (async () => {
      const s = await mongoose.startSession();
      try {
        await s.withTransaction(async () => {
          await inventoryReservationService.commitReservationsForOrder({ session: s, orderId: order._id });
        });
      } finally {
        s.endSession();
      }
    })();

    const cancel = orderStateService.transition({
      orderId: String(order._id),
      toStatus: OrderStatus.CANCELLED,
      actorRole: "ADMIN",
      actorId: String(admin._id),
    });

    const assign = assignPackedOrderToDeliveryBoy({ orderId: String(order._id), deliveryBoyId: String(deliveryBoy._id), actorId: String(admin._id) });

    const fail = orderStateService.transition({
      orderId: String(order._id),
      toStatus: OrderStatus.FAILED,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(deliveryBoy._id),
      meta: { failureReasonCode: "X" },
    });

    await Promise.allSettled([payCommit, cancel, assign, fail]);

    await assertGlobalInvariants();

    const p = await snapshotProduct(String(product._id));
    expect(p.stock).toBeGreaterThanOrEqual(0);
    expect(p.reservedStock).toBeGreaterThanOrEqual(0);

    const notifCount = await Notification.countDocuments({ userId: customer._id });
    expect(notifCount).toBeGreaterThanOrEqual(0);
  });
});
