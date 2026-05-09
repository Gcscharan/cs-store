// apps/customer-app/src/utils/routeAlgorithm.ts

// ---- TYPES ----
export type LatLng = { lat: number; lng: number };

export interface Order {
  _id: string;
  address: { lat: number; lng: number };
  orderStatus?: string;
}

export interface RouteStop {
  order: Order;
  score: number;
  warehouseDist: number;
  driverDist: number;
}

export interface RouteResult {
  routeBefore: RouteStop[];
  routeAfter: RouteStop[];
  distanceBefore: number;
  distanceAfter: number;
}

// ---- CONSTANTS ----
const EARTH_RADIUS_KM = 6371;
const WAREHOUSE = { lat: 17.0956, lng: 80.6089 };

// ---- HAVERSINE ----
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// ---- VALIDATION ----
export function isValidCoord(
  lat?: number | null,
  lng?: number | null
): boolean {
  if (
    lat == null ||
    lng == null ||
    isNaN(lat) ||
    isNaN(lng)
  )
    return false;

  if (lat === 0 && lng === 0) return false;

  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;

  return true;
}

// ---- MOVE TOWARDS ----
// NOTE: This uses linear interpolation, not true geodesic movement.
// Acceptable for regional delivery (<50km distances) but not globally accurate.
// For true bearing-based movement, would need great circle calculations.
export function moveTowards(
  current: LatLng,
  target: LatLng,
  stepMeters: number
): LatLng {
  const distKm = haversineKm(
    current.lat,
    current.lng,
    target.lat,
    target.lng
  );

  if (distKm === 0) return target;

  const stepKm = stepMeters / 1000;

  // no overshoot
  if (stepKm >= distKm) return target;

  const ratio = stepKm / distKm;

  const lat =
    current.lat + (target.lat - current.lat) * ratio;
  const lng =
    current.lng + (target.lng - current.lng) * ratio;

  return { lat, lng };
}

// ---- ROUTE DISTANCE ----
function totalDistance(
  route: RouteStop[],
  start: LatLng
): number {
  let total = 0;
  let prev = start;

  for (const stop of route) {
    total += haversineKm(
      prev.lat,
      prev.lng,
      stop.order.address.lat,
      stop.order.address.lng
    );
    prev = stop.order.address;
  }

  return total;
}

// ---- 2-OPT ----
export function twoOptOptimize(
  route: RouteStop[],
  startLat: number,
  startLng: number,
  maxIterations = 50,
  timeLimitMs = 500
): RouteStop[] {
  if (route.length < 3) return route;

  const startTime = Date.now();
  let best = [...route];

  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;

    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        if (Date.now() - startTime > timeLimitMs) {
          console.warn('[ROUTE_ALGORITHM] 2-opt time limit reached, returning best so far');
          return best;
        }

        const newRoute = [...best];
        const segment = newRoute.slice(i, j).reverse();
        newRoute.splice(i, j - i, ...segment);

        const oldDist = totalDistance(best, {
          lat: startLat,
          lng: startLng,
        });
        const newDist = totalDistance(newRoute, {
          lat: startLat,
          lng: startLng,
        });

        if (newDist < oldDist) {
          best = newRoute;
          improved = true;
        }
      }
    }

    iteration++;
  }

  return best;
}

// ---- MAIN ROUTE ----
export function computeGreedyRoute(
  orders: Order[],
  driverLat: number,
  driverLng: number
): RouteResult {
  const eligible = orders.filter((o) =>
    isValidCoord(o.address.lat, o.address.lng)
  );

  if (eligible.length === 0) {
    return {
      routeBefore: [],
      routeAfter: [],
      distanceBefore: 0,
      distanceAfter: 0,
    };
  }

  const remaining = [...eligible];
  const route: RouteStop[] = [];

  let current: LatLng = { lat: driverLat, lng: driverLng };

  const driverToWarehouse = haversineKm(
    driverLat,
    driverLng,
    WAREHOUSE.lat,
    WAREHOUSE.lng
  );

  const W1 = driverToWarehouse < 5 ? 0.7 : 0.4;
  const W2 = 1 - W1;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const o = remaining[i];

      const warehouseDist = haversineKm(
        o.address.lat,
        o.address.lng,
        WAREHOUSE.lat,
        WAREHOUSE.lng
      );

      const driverDist = haversineKm(
        current.lat,
        current.lng,
        o.address.lat,
        o.address.lng
      );

      let score =
        route.length === 0
          ? warehouseDist * W1 + driverDist * W2
          : driverDist;

      // end penalty (last 3)
      if (remaining.length <= 3) {
        score += warehouseDist * 0.2;
      }

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const chosen = remaining.splice(bestIndex, 1)[0];

    route.push({
      order: chosen,
      score: bestScore,
      warehouseDist: haversineKm(
        chosen.address.lat,
        chosen.address.lng,
        WAREHOUSE.lat,
        WAREHOUSE.lng
      ),
      driverDist: haversineKm(
        current.lat,
        current.lng,
        chosen.address.lat,
        chosen.address.lng
      ),
    });

    current = chosen.address;
  }

  const routeBefore = [...route];

  const distanceBefore = totalDistance(routeBefore, {
    lat: driverLat,
    lng: driverLng,
  });

  const routeAfter = twoOptOptimize(
    routeBefore,
    driverLat,
    driverLng
  );

  const distanceAfter = totalDistance(routeAfter, {
    lat: driverLat,
    lng: driverLng,
  });

  return {
    routeBefore,
    routeAfter,
    distanceBefore,
    distanceAfter,
  };
}