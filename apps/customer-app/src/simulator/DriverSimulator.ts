// apps/customer-app/src/simulator/DriverSimulator.ts

import * as Location from "expo-location";
import { driverLocationStore } from "./driverLocationStore";
import { moveTowards, haversineKm } from "../utils/routeAlgorithm";

type LatLng = { lat: number; lng: number };

type Order = {
  _id: string;
  address: { lat: number; lng: number };
};

type SimulatorState = {
  isRunning: boolean;
  isPaused: boolean;
  currentPosition: LatLng | null;
  currentIndex: number;
  route: Order[];
  speedMultiplier: 1 | 2 | 5;
};

const ARRIVED_THRESHOLD = 40; // meters
const BASE_INTERVAL = 2000; // ms
const BASE_STEP_METERS = 75;

class DriverSimulator {
  private state: SimulatorState = {
    isRunning: false,
    isPaused: false,
    currentPosition: null,
    currentIndex: 0,
    route: [],
    speedMultiplier: 1,
  };

  private interval: any = null;

  // Callbacks
  onArrived: (orderId: string) => void = () => {};
  onDelivered: (orderId: string) => void = () => {};
  onRouteComplete: () => void = () => {};

  // 🔹 START
  async start(route: Order[], isArranged: boolean) {
    if (!__DEV__) {
      console.warn("[SIM] Cannot start in production");
      return;
    }

    if (!isArranged) {
      throw new Error(
        "Route must be arranged before starting simulation"
      );
    }

    if (!route || route.length === 0) {
      console.warn("[SIM] Empty route - cannot start simulation");
      return;
    }

    // Stop existing simulation
    this.reset();

    // Get initial real position once
    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      throw new Error("Location permission denied");
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const startPos = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };

    this.state = {
      isRunning: true,
      isPaused: false,
      currentPosition: startPos,
      currentIndex: 0,
      route,
      speedMultiplier: 1,
    };

    driverLocationStore.setSimulationRunning(true);
    driverLocationStore.set(startPos);

    this.startLoop();
  }

  // 🔹 LOOP
  private startLoop() {
    this.clearLoop();

    const tick = async () => {
      if (!this.state.isRunning || this.state.isPaused) return;

      const currentOrder =
        this.state.route[this.state.currentIndex];

      if (!currentOrder) return;

      const currentPos = this.state.currentPosition!;
      const target = currentOrder.address;

      const stepMeters =
        BASE_STEP_METERS * this.state.speedMultiplier;

      const next = moveTowards(
        currentPos,
        target,
        stepMeters
      );

      this.state.currentPosition = next;
      driverLocationStore.set(next);

      console.log(
        `[SIM] Moving → ${next.lat.toFixed(6)},${next.lng.toFixed(6)}`
      );

      const distMeters =
        haversineKm(
          next.lat,
          next.lng,
          target.lat,
          target.lng
        ) * 1000;

      if (distMeters < ARRIVED_THRESHOLD) {
        await this.handleArrival(currentOrder._id);
      }
    };

    this.interval = setInterval(
      tick,
      BASE_INTERVAL / this.state.speedMultiplier
    );
  }

  // 🔹 ARRIVAL
  private async handleArrival(orderId: string) {
    console.log(`[SIM] Reached Order → ${orderId}`);

    this.onArrived(orderId);

    await new Promise<void>((res) => setTimeout(() => res(), 2000));

    this.onDelivered(orderId);

    console.log(`[SIM] Delivered → ${orderId}`);

    this.moveToNextOrder();
  }

  private moveToNextOrder() {
    this.state.currentIndex++;

    if (this.state.currentIndex >= this.state.route.length) {
      console.log("[SIM] Route complete");

      this.onRouteComplete();
      this.reset();
      return;
    }
  }

  // 🔹 CONTROLS
  pause() {
    this.state.isPaused = true;
  }

  resume() {
    this.state.isPaused = false;
  }

  reset() {
    this.clearLoop();

    this.state = {
      isRunning: false,
      isPaused: false,
      currentPosition: null,
      currentIndex: 0,
      route: [],
      speedMultiplier: 1,
    };

    driverLocationStore.setSimulationRunning(false);
  }

  setSpeed(multiplier: 1 | 2 | 5) {
    this.state.speedMultiplier = multiplier;

    if (this.state.isRunning) {
      this.startLoop(); // restart with new interval
    }
  }

  getState(): Readonly<SimulatorState> {
    return this.state;
  }

  private clearLoop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const driverSimulator = new DriverSimulator();