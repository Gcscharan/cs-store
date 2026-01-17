import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { Client } from "@googlemaps/google-maps-services-js";
import polyline from "@mapbox/polyline";
import { Route as PersistedRoute } from "../models/Route";
import { Order } from "../models/Order";
import { calculateHaversineDistance } from "../utils/routeUtils";

dotenv.config();

type LatLng = { lat: number; lng: number };

type Checkpoint = {
  orderId: string;
  lat: number;
  lng: number;
};

type LegMetrics = {
  distanceMeters: number;
  durationSeconds: number;
  turns: number;
  decodedPath: LatLng[];
};

type RouteMetrics = {
  distanceKm: number;
  timeMin: number;
  turns: number;
  backtrackingDistanceKm: number;
  backtrackingHotspot: LatLng | null;
};

type CandidateMetrics = {
  routeType: string;
  distanceKm: number;
  timeMin: number;
  turns: number;
};

const WAREHOUSE: LatLng = { lat: 17.094, lng: 80.598 };

const googleMapsClient = new Client({});

function parseArgs(): { routeId: string | null } {
  const args = process.argv.slice(2);
  const routeIdFlag = args.find((a) => a.startsWith("--routeId="));
  if (routeIdFlag) {
    const v = routeIdFlag.split("=").slice(1).join("=");
    return { routeId: v ? String(v).trim() : null };
  }
  const first = args[0];
  return { routeId: first ? String(first).trim() : null };
}

function safeNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toKey(p: LatLng): string {
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

function countTurnsFromDirections(route: any): number {
  try {
    const legs = Array.isArray(route?.legs) ? route.legs : [];
    let turns = 0;
    for (const leg of legs) {
      const steps = Array.isArray(leg?.steps) ? leg.steps : [];
      for (const step of steps) {
        const maneuver = String(step?.maneuver || "").trim();
        if (maneuver) {
          turns += 1;
          continue;
        }
        const inst = String(step?.html_instructions || "").toLowerCase();
        if (inst.includes("turn") || inst.includes("merge") || inst.includes("roundabout") || inst.includes("keep")) {
          turns += 1;
        }
      }
    }
    return turns;
  } catch {
    return 0;
  }
}

async function getLegMetrics(origin: LatLng, destination: LatLng, apiKey: string, cache: Map<string, LegMetrics>): Promise<LegMetrics> {
  const cacheKey = `${toKey(origin)}->${toKey(destination)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const res = await googleMapsClient.directions({
    params: {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: apiKey,
      mode: "driving" as any,
      alternatives: false,
    },
  });

  if (res.data.status !== "OK" || !Array.isArray(res.data.routes) || res.data.routes.length === 0) {
    throw new Error(`Directions API error: ${String(res.data.status || "UNKNOWN")}`);
  }

  const route = res.data.routes[0];
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const distanceMeters = legs.reduce((sum: number, leg: any) => sum + (Number(leg?.distance?.value) || 0), 0);
  const durationSeconds = legs.reduce((sum: number, leg: any) => sum + (Number(leg?.duration?.value) || 0), 0);
  const turns = countTurnsFromDirections(route);

  const encoded = route?.overview_polyline?.points ? String(route.overview_polyline.points) : "";
  const decodedPath: LatLng[] = encoded
    ? polyline.decode(encoded).map(([lat, lng]: [number, number]) => ({ lat, lng }))
    : [origin, destination];

  const metrics: LegMetrics = {
    distanceMeters,
    durationSeconds,
    turns,
    decodedPath,
  };

  cache.set(cacheKey, metrics);
  return metrics;
}

function estimateBacktracking(decodedPath: LatLng[]): { distanceKm: number; hotspot: LatLng | null } {
  if (!decodedPath || decodedPath.length < 4) {
    return { distanceKm: 0, hotspot: null };
  }

  const grid = new Map<string, Array<{ mid: LatLng; headingDeg: number }>>();
  const cellSizeDeg = 0.001;

  const toCellKey = (p: LatLng): string => {
    const cx = Math.round(p.lat / cellSizeDeg);
    const cy = Math.round(p.lng / cellSizeDeg);
    return `${cx},${cy}`;
  };

  const heading = (a: LatLng, b: LatLng): number => {
    const dy = b.lat - a.lat;
    const dx = b.lng - a.lng;
    const rad = Math.atan2(dy, dx);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  };

  const headingDiff = (h1: number, h2: number): number => {
    const d = Math.abs(h1 - h2) % 360;
    return d > 180 ? 360 - d : d;
  };

  let backtrackKm = 0;
  let bestHotspot: LatLng | null = null;
  let bestScore = 0;

  for (let i = 0; i < decodedPath.length - 1; i++) {
    const a = decodedPath[i];
    const b = decodedPath[i + 1];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const h = heading(a, b);

    const segKm = calculateHaversineDistance(a, b);

    const key = toCellKey(mid);
    const [cxStr, cyStr] = key.split(",");
    const cx = Number(cxStr);
    const cy = Number(cyStr);

    let reverseHit = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const prev of bucket) {
          const dKm = calculateHaversineDistance(mid, prev.mid);
          if (dKm > 0.08) continue;
          const hd = headingDiff(h, prev.headingDeg);
          if (hd >= 150) {
            reverseHit += 1;
          }
        }
      }
    }

    if (reverseHit > 0) {
      backtrackKm += segKm;
      if (reverseHit > bestScore) {
        bestScore = reverseHit;
        bestHotspot = mid;
      }
    }

    const bucket = grid.get(key) || [];
    bucket.push({ mid, headingDeg: h });
    grid.set(key, bucket);
  }

  return { distanceKm: Math.round(backtrackKm * 100) / 100, hotspot: bestHotspot };
}

async function computeRouteMetrics(points: LatLng[], apiKey: string, legCache: Map<string, LegMetrics>): Promise<RouteMetrics> {
  if (points.length < 2) {
    return { distanceKm: 0, timeMin: 0, turns: 0, backtrackingDistanceKm: 0, backtrackingHotspot: null };
  }

  let distanceMeters = 0;
  let durationSeconds = 0;
  let turns = 0;
  const fullPath: LatLng[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const leg = await getLegMetrics(points[i], points[i + 1], apiKey, legCache);
    distanceMeters += leg.distanceMeters;
    durationSeconds += leg.durationSeconds;
    turns += leg.turns;

    if (leg.decodedPath.length > 0) {
      if (fullPath.length === 0) {
        fullPath.push(...leg.decodedPath);
      } else {
        fullPath.push(...leg.decodedPath.slice(1));
      }
    }
  }

  const back = estimateBacktracking(fullPath);

  return {
    distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
    timeMin: Math.round((durationSeconds / 60) * 10) / 10,
    turns,
    backtrackingDistanceKm: back.distanceKm,
    backtrackingHotspot: back.hotspot,
  };
}

function buildNearestNeighborOrder(warehouse: LatLng, checkpoints: Checkpoint[]): Checkpoint[] {
  const remaining = checkpoints.slice();
  const ordered: Checkpoint[] = [];
  let cur: LatLng = warehouse;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const d = calculateHaversineDistance(cur, { lat: c.lat, lng: c.lng });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cur = { lat: next.lat, lng: next.lng };
  }

  return ordered;
}

function twoOptImprove(checkpoints: Checkpoint[], maxIterations: number): Checkpoint[] {
  if (checkpoints.length < 4) return checkpoints;

  const cost = (path: Checkpoint[]): number => {
    let sum = 0;
    let prev = WAREHOUSE;
    for (const p of path) {
      sum += calculateHaversineDistance(prev, { lat: p.lat, lng: p.lng });
      prev = { lat: p.lat, lng: p.lng };
    }
    return sum;
  };

  let best = checkpoints.slice();
  let bestCost = cost(best);

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;

    for (let i = 0; i < best.length - 2; i++) {
      for (let k = i + 1; k < best.length - 1; k++) {
        const candidate = best.slice(0, i + 1).concat(best.slice(i + 1, k + 1).reverse(), best.slice(k + 1));
        const c = cost(candidate);
        if (c + 1e-6 < bestCost) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

async function buildRoadDistanceMatrix(warehouse: LatLng, checkpoints: Checkpoint[], apiKey: string, legCache: Map<string, LegMetrics>): Promise<{ fromWarehouse: number[]; between: number[][]; timeFromWarehouse: number[]; timeBetween: number[][]; turnsFromWarehouse: number[]; turnsBetween: number[][]; }> {
  const n = checkpoints.length;
  const fromWarehouse = new Array(n).fill(0);
  const timeFromWarehouse = new Array(n).fill(0);
  const turnsFromWarehouse = new Array(n).fill(0);

  const between = Array.from({ length: n }, () => new Array(n).fill(0));
  const timeBetween = Array.from({ length: n }, () => new Array(n).fill(0));
  const turnsBetween = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let j = 0; j < n; j++) {
    const leg = await getLegMetrics(warehouse, { lat: checkpoints[j].lat, lng: checkpoints[j].lng }, apiKey, legCache);
    fromWarehouse[j] = leg.distanceMeters;
    timeFromWarehouse[j] = leg.durationSeconds;
    turnsFromWarehouse[j] = leg.turns;
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const leg = await getLegMetrics({ lat: checkpoints[i].lat, lng: checkpoints[i].lng }, { lat: checkpoints[j].lat, lng: checkpoints[j].lng }, apiKey, legCache);
      between[i][j] = leg.distanceMeters;
      timeBetween[i][j] = leg.durationSeconds;
      turnsBetween[i][j] = leg.turns;
    }
  }

  return { fromWarehouse, between, timeFromWarehouse, timeBetween, turnsFromWarehouse, turnsBetween };
}

function heldKarpBestPath(matrix: { fromWarehouse: number[]; between: number[][] }): { order: number[]; totalDistanceMeters: number } {
  const { fromWarehouse, between } = matrix;
  const n = fromWarehouse.length;
  const fullMask = (1 << n) - 1;

  const dp: Array<Map<number, { cost: number; prev: number | null }>> = Array.from({ length: 1 << n }, () => new Map());

  for (let j = 0; j < n; j++) {
    dp[1 << j].set(j, { cost: fromWarehouse[j], prev: null });
  }

  for (let mask = 1; mask <= fullMask; mask++) {
    for (const [j, state] of dp[mask].entries()) {
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const nextMask = mask | (1 << k);
        const nextCost = state.cost + between[j][k];
        const existing = dp[nextMask].get(k);
        if (!existing || nextCost < existing.cost) {
          dp[nextMask].set(k, { cost: nextCost, prev: j });
        }
      }
    }
  }

  let bestEnd = 0;
  let bestCost = Infinity;
  for (const [j, state] of dp[fullMask].entries()) {
    if (state.cost < bestCost) {
      bestCost = state.cost;
      bestEnd = j;
    }
  }

  const order: number[] = [];
  let curMask = fullMask;
  let cur = bestEnd;
  while (true) {
    order.push(cur);
    const st = dp[curMask].get(cur);
    if (!st || st.prev === null) break;
    curMask = curMask & ~(1 << cur);
    cur = st.prev;
  }

  order.reverse();
  return { order, totalDistanceMeters: bestCost };
}

function verdict(deviationPct: number): string {
  if (deviationPct <= 5) return "OPTIMAL";
  if (deviationPct <= 15) return "ACCEPTABLE BUT NOT OPTIMAL";
  return "POOR ROUTE";
}

function percentDiff(current: number, best: number): number {
  if (best <= 0) return 0;
  return Math.round((((current - best) / best) * 100) * 10) / 10;
}

async function main() {
  const { routeId } = parseArgs();
  if (!routeId) {
    console.error("Usage: ts-node src/scripts/clusterRouteAudit.ts --routeId=<ROUTE_ID>");
    process.exit(1);
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    process.exit(1);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("❌ CRITICAL: GOOGLE_MAPS_API_KEY environment variable is not set!");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI as string);

  try {
    const route = await PersistedRoute.findOne({ routeId }).lean();
    if (!route) {
      console.error(`❌ Route not found: ${routeId}`);
      process.exitCode = 1;
      return;
    }

    const routePath = Array.isArray((route as any).routePath) ? ((route as any).routePath as string[]) : [];
    const orderedIds = routePath
      .filter((x) => String(x || "").toUpperCase() !== "WAREHOUSE")
      .map((x) => String(x));

    const fallbackIds = Array.isArray((route as any).orderIds)
      ? ((route as any).orderIds as any[]).map((x) => String(x))
      : [];

    const orderIds = orderedIds.length > 0 ? orderedIds : fallbackIds;

    const orderDocs = await Order.find({ _id: { $in: orderIds } })
      .select("_id address.lat address.lng")
      .lean();

    const byId = new Map<string, any>();
    for (const o of orderDocs as any[]) {
      byId.set(String((o as any)._id), o);
    }

    const checkpointsAll: Array<{ orderId: string; lat: number | null; lng: number | null }> = orderIds.map((id) => {
      const o = byId.get(String(id));
      const lat = safeNumber(o?.address?.lat);
      const lng = safeNumber(o?.address?.lng);
      const valid = lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
      return {
        orderId: String(id),
        lat: valid ? (lat as number) : null,
        lng: valid ? (lng as number) : null,
      };
    });

    const invalidOrderIds = checkpointsAll.filter((c) => c.lat === null || c.lng === null).map((c) => c.orderId);
    const checkpoints: Checkpoint[] = checkpointsAll
      .filter((c) => typeof c.lat === "number" && typeof c.lng === "number")
      .map((c) => ({ orderId: c.orderId, lat: c.lat as number, lng: c.lng as number }));

    const legCache = new Map<string, LegMetrics>();

    const currentPoints: LatLng[] = [WAREHOUSE, ...checkpoints.map((c) => ({ lat: c.lat, lng: c.lng }))];
    const CURRENT_ROUTE_METRICS = await computeRouteMetrics(currentPoints, apiKey, legCache);

    const nnOrder = buildNearestNeighborOrder(WAREHOUSE, checkpoints);
    const nnMetrics = await computeRouteMetrics([WAREHOUSE, ...nnOrder.map((c) => ({ lat: c.lat, lng: c.lng }))], apiKey, legCache);

    const optOrder = twoOptImprove(checkpoints, 80);
    const optMetrics = await computeRouteMetrics([WAREHOUSE, ...optOrder.map((c) => ({ lat: c.lat, lng: c.lng }))], apiKey, legCache);

    const alternates: CandidateMetrics[] = [
      { routeType: "Nearest Neighbor", distanceKm: nnMetrics.distanceKm, timeMin: nnMetrics.timeMin, turns: nnMetrics.turns },
      { routeType: "2-Opt Optimized", distanceKm: optMetrics.distanceKm, timeMin: optMetrics.timeMin, turns: optMetrics.turns },
    ];

    let global: { order: Checkpoint[]; metrics: RouteMetrics } | null = null;

    if (checkpoints.length > 0 && checkpoints.length <= 8) {
      const matrix = await buildRoadDistanceMatrix(WAREHOUSE, checkpoints, apiKey, legCache);
      const best = heldKarpBestPath(matrix);
      const bestOrder = best.order.map((idx) => checkpoints[idx]);
      const bestMetrics = await computeRouteMetrics([WAREHOUSE, ...bestOrder.map((c) => ({ lat: c.lat, lng: c.lng }))], apiKey, legCache);
      global = { order: bestOrder, metrics: bestMetrics };
      alternates.push({ routeType: "Global Optimal", distanceKm: bestMetrics.distanceKm, timeMin: bestMetrics.timeMin, turns: bestMetrics.turns });
    }

    const bestAlt = [...alternates].sort((a, b) => a.distanceKm - b.distanceKm)[0];
    const deviationPct = percentDiff(CURRENT_ROUTE_METRICS.distanceKm, bestAlt.distanceKm);
    const verdictLabel = verdict(deviationPct);

    let bestSwap: { i: number; j: number; improvementKm: number } | null = null;
    if (checkpoints.length >= 4) {
      const matrix = await buildRoadDistanceMatrix(WAREHOUSE, checkpoints, apiKey, legCache);
      const dist = (idxA: number | null, idxB: number | null): number => {
        if (idxA === null && idxB === null) return 0;
        if (idxA === null && idxB !== null) return matrix.fromWarehouse[idxB];
        if (idxA !== null && idxB !== null) return matrix.between[idxA][idxB];
        return 0;
      };

      for (let i = 0; i < checkpoints.length - 2; i++) {
        for (let j = i + 1; j < checkpoints.length - 1; j++) {
          const a = i === 0 ? null : i - 1;
          const b = i;
          const c = j;
          const d = j + 1;

          const before = dist(a, b) + dist(c, d);
          const after = dist(a, c) + dist(b, d);

          const improvementMeters = before - after;
          if (improvementMeters > 0) {
            const improvementKm = Math.round((improvementMeters / 1000) * 10) / 10;
            if (!bestSwap || improvementKm > bestSwap.improvementKm) {
              bestSwap = { i: b + 1, j: c + 1, improvementKm };
            }
          }
        }
      }
    }

    const issues: string[] = [];

    if (CURRENT_ROUTE_METRICS.backtrackingDistanceKm > 0) {
      const hs = CURRENT_ROUTE_METRICS.backtrackingHotspot;
      issues.push(
        hs
          ? `Backtracking detected (approx ${CURRENT_ROUTE_METRICS.backtrackingDistanceKm} km) near ${hs.lat.toFixed(4)},${hs.lng.toFixed(4)}`
          : `Backtracking detected (approx ${CURRENT_ROUTE_METRICS.backtrackingDistanceKm} km)`
      );
    }

    if (bestSwap && bestSwap.improvementKm > 0) {
      issues.push(`Best 2-opt style swap (between positions ${bestSwap.i} ↔ ${bestSwap.j}) improves by ~${bestSwap.improvementKm} km`);
    }

    if (invalidOrderIds.length > 0) {
      issues.push(`Excluded ${invalidOrderIds.length} orders with invalid/missing coordinates from route audit`);
    }

    const prettyTable = (rows: Array<{ type: string; dist: number; time: number; pct: string }>) => {
      const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
      const header = `${pad("Route Type", 20)}  ${pad("Distance (km)", 13)}  ${pad("Time (min)", 10)}  ${pad("% Better/Worse", 14)}`;
      const lines = rows.map((r) => `${pad(r.type, 20)}  ${pad(r.dist.toFixed(2), 13)}  ${pad(r.time.toFixed(1), 10)}  ${pad(r.pct, 14)}`);
      return [header, ...lines].join("\n");
    };

    const bestDistance = bestAlt.distanceKm;

    const rows = [
      {
        type: "Current",
        dist: CURRENT_ROUTE_METRICS.distanceKm,
        time: CURRENT_ROUTE_METRICS.timeMin,
        pct: "baseline",
      },
      ...alternates.map((a) => ({
        type: a.routeType,
        dist: a.distanceKm,
        time: a.timeMin,
        pct: `${a.distanceKm < CURRENT_ROUTE_METRICS.distanceKm ? "-" : "+"}${Math.abs(percentDiff(a.distanceKm, CURRENT_ROUTE_METRICS.distanceKm)).toFixed(1)}% vs current`,
      })),
    ];

    console.log("\nCLUSTER ROUTE AUDIT REPORT");
    console.log("-------------------------");
    console.log(`RouteId: ${routeId}`);
    console.log(`Warehouse: ${WAREHOUSE.lat},${WAREHOUSE.lng}`);
    console.log(`Checkpoints: ${checkpoints.length}`);
    console.log(`Current distance: ${CURRENT_ROUTE_METRICS.distanceKm.toFixed(2)} km`);
    console.log(`Current time: ${CURRENT_ROUTE_METRICS.timeMin.toFixed(1)} min`);
    console.log(`Current turns: ${CURRENT_ROUTE_METRICS.turns}`);
    console.log(`Backtracking distance: ${CURRENT_ROUTE_METRICS.backtrackingDistanceKm.toFixed(2)} km`);
    console.log(`Best alternative distance: ${bestDistance.toFixed(2)} km (${bestAlt.routeType})`);
    console.log(`Deviation: ${deviationPct >= 0 ? "+" : ""}${deviationPct.toFixed(1)}%`);
    console.log("");

    console.log(prettyTable([
      { type: "Current", dist: CURRENT_ROUTE_METRICS.distanceKm, time: CURRENT_ROUTE_METRICS.timeMin, pct: "baseline" },
      ...alternates.map((a) => ({
        type: a.routeType,
        dist: a.distanceKm,
        time: a.timeMin,
        pct: `${a.distanceKm < CURRENT_ROUTE_METRICS.distanceKm ? "better" : "worse"} by ${Math.abs(percentDiff(a.distanceKm, CURRENT_ROUTE_METRICS.distanceKm)).toFixed(1)}%`,
      })),
    ]));

    console.log("");
    console.log(`VERDICT: ${verdictLabel}`);

    if (issues.length > 0) {
      console.log("\nTop issues:");
      for (const it of issues) {
        console.log(`- ${it}`);
      }
    }

    if (verdictLabel === "POOR ROUTE") {
      console.warn("\n[DEV WARNING] Route deviation > 15% — investigate checkpoint ordering.");
    }

    if (global) {
      const ids = global.order.map((c) => c.orderId);
      console.log("\nGlobal Optimal order (orderIds):");
      console.log(ids.join(" -> "));
    }

    console.log("\nCurrent order (orderIds):");
    console.log(checkpoints.map((c) => c.orderId).join(" -> "));

    if (nnOrder.length > 0) {
      console.log("\nNearest Neighbor order (orderIds):");
      console.log(nnOrder.map((c) => c.orderId).join(" -> "));
    }

    if (optOrder.length > 0) {
      console.log("\n2-Opt Optimized order (orderIds):");
      console.log(optOrder.map((c) => c.orderId).join(" -> "));
    }

  } finally {
    await mongoose.connection.close().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error("❌ Audit failed:", e);
  process.exitCode = 1;
});
