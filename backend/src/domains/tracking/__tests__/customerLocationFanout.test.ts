import {
  normalizeOrderIds,
  isTrackableStatus,
  buildCustomerLocationPayload,
  customerRoom,
  CUSTOMER_LOCATION_EVENT,
} from "../customerLocationFanout";

describe("customerLocationFanout", () => {
  describe("normalizeOrderIds", () => {
    it("uses canonical plural orderIds", () => {
      expect(normalizeOrderIds({ orderIds: ["a", "b"] } as any)).toEqual(["a", "b"]);
    });

    it("falls back to singular orderId", () => {
      expect(normalizeOrderIds({ orderId: "x" } as any)).toEqual(["x"]);
    });

    it("regression: a location with only orderIds (not orderId) still fans out", () => {
      // This was the production bug — the fan-out read `loc.orderId` (undefined)
      // while the stored object only had `orderIds`, so customers got nothing.
      const loc = { driverId: "d1", orderIds: ["order_1"], lat: 1, lng: 2 };
      expect(normalizeOrderIds(loc as any)).toEqual(["order_1"]);
    });

    it("dedupes and drops empties", () => {
      expect(normalizeOrderIds({ orderIds: ["a", "a", "", null, "b"] } as any)).toEqual(["a", "b"]);
    });

    it("returns [] for null/empty", () => {
      expect(normalizeOrderIds(null)).toEqual([]);
      expect(normalizeOrderIds({} as any)).toEqual([]);
    });
  });

  describe("isTrackableStatus", () => {
    it.each(["CONFIRMED", "PACKED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"])(
      "%s is trackable",
      (s) => expect(isTrackableStatus(s)).toBe(true)
    );

    it.each(["DELIVERED", "CANCELLED", "REFUNDED", "FAILED", "RETURNED"])(
      "%s is NOT trackable",
      (s) => expect(isTrackableStatus(s)).toBe(false)
    );

    it("is case-insensitive and rejects empty", () => {
      expect(isTrackableStatus("in_transit")).toBe(true);
      expect(isTrackableStatus("")).toBe(false);
      expect(isTrackableStatus(undefined)).toBe(false);
    });
  });

  describe("buildCustomerLocationPayload", () => {
    it("matches the customer app contract (event + fields)", () => {
      const loc = { lat: 17.412345, lng: 78.391298, heading: 90, speed: 4, receivedAt: 1_700_000_000_000 };
      const payload = buildCustomerLocationPayload(loc as any, "order_1", { etaMinutes: 7, distanceRemainingM: 1200 });

      expect(CUSTOMER_LOCATION_EVENT).toBe("delivery_location_updated");
      expect(payload.orderId).toBe("order_1");
      // Rounded to ~111m for privacy.
      expect(payload.latitude).toBe(17.412);
      expect(payload.longitude).toBe(78.391);
      expect(payload.heading).toBe(90);
      expect(payload.speed).toBe(4);
      expect(payload.etaMinutes).toBe(7);
      expect(payload.distanceRemainingM).toBe(1200);
      expect(typeof payload.lastUpdated).toBe("string");
    });

    it("omits heading/speed when not finite", () => {
      const payload = buildCustomerLocationPayload({ lat: 1, lng: 2 } as any, "o1");
      expect(payload.heading).toBeUndefined();
      expect(payload.speed).toBeUndefined();
    });
  });

  it("customerRoom builds the order room name", () => {
    expect(customerRoom("abc")).toBe("order:abc");
  });
});
