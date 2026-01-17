import { deriveSemanticState } from "../../src/domains/tracking/phase2/fsm";

describe("Phase 2 semantic FSM", () => {
  it("maps lifecycle picked_up to IN_TRANSIT", () => {
    const r = deriveSemanticState({
      prevInternalState: null,
      prevCheckpointState: null,
      lastUpdatedAt: null,
      movementState: "MOVING",
      nowIso: "2026-01-01T00:00:10.000Z",
      smoothedLat: 17.4,
      smoothedLng: 78.39,
      destination: { lat: 17.5, lng: 78.5 },
      orderStatus: "picked_up",
      deliveryStatus: "in_transit",
    });

    expect(r.internalState).toBe("IN_TRANSIT");
    expect(r.checkpointState).toBe("ON_THE_WAY");
    expect(r.transition?.to).toBe("IN_TRANSIT");
  });

  it("produces NEAR_DESTINATION when within radius", () => {
    const r = deriveSemanticState({
      prevInternalState: "IN_TRANSIT",
      prevCheckpointState: "ON_THE_WAY",
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
      movementState: "MOVING",
      nowIso: "2026-01-01T00:00:10.000Z",
      smoothedLat: 17.4001,
      smoothedLng: 78.3901,
      destination: { lat: 17.4002, lng: 78.3902 },
      orderStatus: "in_transit",
      deliveryStatus: "in_transit",
      config: { nearDestinationRadiusM: 500 },
    });

    expect(r.internalState).toBe("NEAR_DESTINATION");
    expect(r.checkpointState).toBe("NEARBY");
  });

  it("enforces one-way checkpoint progression", () => {
    const r = deriveSemanticState({
      prevInternalState: "NEAR_DESTINATION",
      prevCheckpointState: "NEARBY",
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
      movementState: "MOVING",
      nowIso: "2026-01-01T00:00:10.000Z",
      smoothedLat: 17.0,
      smoothedLng: 78.0,
      destination: { lat: 18.0, lng: 79.0 },
      orderStatus: "picked_up",
      deliveryStatus: "in_transit",
    });

    expect(r.checkpointState).toBe("NEARBY");
  });
});
