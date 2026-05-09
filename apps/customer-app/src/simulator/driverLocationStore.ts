// apps/customer-app/src/simulator/driverLocationStore.ts

export type LatLng = { lat: number; lng: number };

type Subscriber = (pos: LatLng) => void;

class DriverLocationStore {
  private _current: LatLng | null = null;
  private _isSimulationRunning = false;
  private subscribers = new Set<Subscriber>();

  get current(): LatLng | null {
    return this._current;
  }

  get isSimulationRunning(): boolean {
    return this._isSimulationRunning;
  }

  set(pos: LatLng) {
    this._current = pos;

    // synchronous notify
    this.subscribers.forEach((cb) => {
      try {
        cb(pos);
      } catch (e) {
        console.warn("[driverLocationStore] subscriber error", e);
      }
    });
  }

  setSimulationRunning(running: boolean) {
    this._isSimulationRunning = running;
  }

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);

    return () => {
      this.subscribers.delete(cb);
    };
  }
}

export const driverLocationStore = new DriverLocationStore();