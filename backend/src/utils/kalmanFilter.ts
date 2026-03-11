/**
 * Kalman Filter for GPS Smoothing
 * Reduces GPS jitter and noise for smoother tracking
 */

export type KalmanState = {
  value: number;
  variance: number;
};

export type KalmanParams = {
  processNoise: number; // Q - How much the system changes between measurements
  measurementNoise: number; // R - GPS accuracy variance
};

const DEFAULT_PROCESS_NOISE = 0.001;
const DEFAULT_MEASUREMENT_NOISE = 10; // meters^2

/**
 * 1D Kalman Filter for smoothing a single coordinate dimension
 */
export class KalmanFilter1D {
  private state: KalmanState;
  private params: KalmanParams;

  constructor(initialValue: number, params?: Partial<KalmanParams>) {
    this.state = {
      value: initialValue,
      variance: params?.measurementNoise ?? DEFAULT_MEASUREMENT_NOISE,
    };

    this.params = {
      processNoise: params?.processNoise ?? DEFAULT_PROCESS_NOISE,
      measurementNoise: params?.measurementNoise ?? DEFAULT_MEASUREMENT_NOISE,
    };
  }

  /**
   * Update filter with new measurement
   * @param measurement New GPS coordinate value
   * @param measurementNoise Optional measurement variance (from accuracyM)
   */
  update(measurement: number, measurementNoise?: number): number {
    // Use provided measurement noise or default
    const R = measurementNoise ?? this.params.measurementNoise;

    // Prediction step: state doesn't change, variance increases
    const predictedVariance = this.state.variance + this.params.processNoise;

    // Update step: combine prediction with measurement
    const kalmanGain = predictedVariance / (predictedVariance + R);

    this.state.value = this.state.value + kalmanGain * (measurement - this.state.value);
    this.state.variance = (1 - kalmanGain) * predictedVariance;

    return this.state.value;
  }

  /**
   * Get current smoothed value
   */
  getValue(): number {
    return this.state.value;
  }

  /**
   * Get current variance
   */
  getVariance(): number {
    return this.state.variance;
  }

  /**
   * Reset filter with new initial value
   */
  reset(value: number): void {
    this.state = {
      value,
      variance: this.params.measurementNoise,
    };
  }
}

/**
 * 2D Kalman Filter for smoothing lat/lng coordinates together
 */
export class KalmanFilter2D {
  private latFilter: KalmanFilter1D;
  private lngFilter: KalmanFilter1D;

  constructor(
    initialLat: number,
    initialLng: number,
    params?: Partial<KalmanParams>
  ) {
    this.latFilter = new KalmanFilter1D(initialLat, params);
    this.lngFilter = new KalmanFilter1D(initialLng, params);
  }

  /**
   * Update filter with new GPS coordinates
   * @param lat Latitude measurement
   * @param lng Longitude measurement
   * @param accuracyM GPS accuracy in meters (converted to variance)
   */
  update(lat: number, lng: number, accuracyM?: number): { lat: number; lng: number } {
    // Convert accuracy to variance (roughly accuracy^2)
    // Scale for lat/lng: 1 degree ≈ 111km, so 1 meter ≈ 0.000009 degrees
    const variance = accuracyM
      ? Math.pow(accuracyM / 111000, 2) // Convert meters to degrees^2
      : undefined;

    const smoothedLat = this.latFilter.update(lat, variance);
    const smoothedLng = this.lngFilter.update(lng, variance);

    return { lat: smoothedLat, lng: smoothedLng };
  }

  /**
   * Get current smoothed coordinates
   */
  getValue(): { lat: number; lng: number } {
    return {
      lat: this.latFilter.getValue(),
      lng: this.lngFilter.getValue(),
    };
  }

  /**
   * Reset filter with new coordinates
   */
  reset(lat: number, lng: number): void {
    this.latFilter.reset(lat);
    this.lngFilter.reset(lng);
  }
}

/**
 * Kalman Filter Manager for tracking multiple riders
 * Maintains separate filter instances per rider
 */
export class KalmanFilterManager {
  private filters: Map<string, KalmanFilter2D> = new Map();

  /**
   * Get or create filter for a rider
   */
  getFilter(riderId: string, initialLat?: number, initialLng?: number): KalmanFilter2D | null {
    if (!this.filters.has(riderId)) {
      if (initialLat === undefined || initialLng === undefined) {
        return null;
      }
      this.filters.set(riderId, new KalmanFilter2D(initialLat, initialLng));
    }
    return this.filters.get(riderId)!;
  }

  /**
   * Update rider's filter with new coordinates
   */
  update(
    riderId: string,
    lat: number,
    lng: number,
    accuracyM?: number
  ): { lat: number; lng: number } {
    let filter = this.filters.get(riderId);

    if (!filter) {
      // Create new filter with first measurement
      filter = new KalmanFilter2D(lat, lng);
      this.filters.set(riderId, filter);
      return { lat, lng }; // Return raw for first measurement
    }

    return filter.update(lat, lng, accuracyM);
  }

  /**
   * Remove filter for a rider (when order completes)
   */
  removeFilter(riderId: string): void {
    this.filters.delete(riderId);
  }

  /**
   * Clear all filters
   */
  clear(): void {
    this.filters.clear();
  }

  /**
   * Get number of active filters
   */
  size(): number {
    return this.filters.size;
  }
}

// Singleton instance for global use
export const kalmanFilterManager = new KalmanFilterManager();

export default {
  KalmanFilter1D,
  KalmanFilter2D,
  KalmanFilterManager,
  kalmanFilterManager,
};
