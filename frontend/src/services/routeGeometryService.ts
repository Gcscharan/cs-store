export type LatLngPoint = { lat: number; lng: number };

export type OsrmRouteGeometry = {
  fullPath: LatLngPoint[];
  legs: LatLngPoint[][];
};

type OsrmResponse = {
  code: string;
  message?: string;
  routes?: Array<{
    legs?: Array<{
      steps?: Array<{
        geometry?: {
          type: "LineString";
          coordinates: Array<[number, number]>; // [lng, lat]
        };
      }>;
    }>;
  }>;
};

const geometryCache = new Map<string, Promise<OsrmRouteGeometry>>();

const roundCoord = (v: number) => Math.round(v * 1e5) / 1e5;

export const buildWaypointsCacheKey = (routeId: string, waypoints: LatLngPoint[]): string => {
  const pts = (waypoints || [])
    .map((p) => `${roundCoord(p.lat)},${roundCoord(p.lng)}`)
    .join(";");
  return `${routeId}::${pts}`;
};

export const hasRoadRouteGeometryOsrmCache = (routeId: string, waypoints: LatLngPoint[]): boolean => {
  const safeWaypoints = (waypoints || []).filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (safeWaypoints.length < 2) return false;
  const key = buildWaypointsCacheKey(routeId, safeWaypoints);
  return geometryCache.has(key);
};

const dedupeConsecutive = (coords: LatLngPoint[]): LatLngPoint[] => {
  const out: LatLngPoint[] = [];
  for (const c of coords) {
    const prev = out[out.length - 1];
    if (prev && prev.lat === c.lat && prev.lng === c.lng) continue;
    out.push(c);
  }
  return out;
};

const appendCoords = (acc: LatLngPoint[], coords: Array<[number, number]>) => {
  for (const [lng, lat] of coords) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    acc.push({ lat, lng });
  }
};

const fetchOsrmRouteSteps = async (waypoints: LatLngPoint[]): Promise<OsrmRouteGeometry> => {
  const coordsParam = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as OsrmResponse;

  if (!res.ok || !data || data.code !== "Ok") {
    const msg = (data as any)?.message || `OSRM route failed (${res.status})`;
    throw new Error(msg);
  }

  const legs = (data.routes?.[0]?.legs || []).map((leg) => {
    const out: LatLngPoint[] = [];
    for (const step of leg.steps || []) {
      const coords = step.geometry?.coordinates;
      if (!coords || coords.length === 0) continue;
      appendCoords(out, coords);
    }
    return dedupeConsecutive(out);
  });

  const full: LatLngPoint[] = [];
  for (const leg of legs) {
    for (const p of leg) full.push(p);
  }

  return {
    fullPath: dedupeConsecutive(full),
    legs,
  };
};

const chunkWaypoints = (waypoints: LatLngPoint[], maxPerRequest: number): LatLngPoint[][] => {
  if (waypoints.length <= maxPerRequest) return [waypoints];

  const chunks: LatLngPoint[][] = [];
  let start = 0;
  while (start < waypoints.length) {
    const end = Math.min(waypoints.length, start + maxPerRequest);
    const slice = waypoints.slice(start, end);
    if (chunks.length > 0) {
      const prevLast = chunks[chunks.length - 1][chunks[chunks.length - 1].length - 1];
      const first = slice[0];
      if (!first || !prevLast || first.lat !== prevLast.lat || first.lng !== prevLast.lng) {
        slice.unshift(prevLast);
      }
    }
    chunks.push(slice);
    if (end === waypoints.length) break;
    start = end - 1; // overlap by 1 to keep continuity between chunks
  }

  return chunks;
};

export const getRoadRouteGeometryOsrm = async (routeId: string, waypoints: LatLngPoint[]): Promise<OsrmRouteGeometry> => {
  const safeWaypoints = (waypoints || []).filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  if (safeWaypoints.length < 2) {
    return { fullPath: [], legs: [] };
  }

  const key = buildWaypointsCacheKey(routeId, safeWaypoints);
  const cached = geometryCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    // OSRM public instances commonly limit waypoints per request.
    // We preserve road accuracy by chunking the waypoint list and stitching the results.
    const MAX_PER_REQUEST = 25;
    const chunks = chunkWaypoints(safeWaypoints, MAX_PER_REQUEST);

    const stitchedLegs: LatLngPoint[][] = [];
    for (const chunk of chunks) {
      const part = await fetchOsrmRouteSteps(chunk);

      // If we overlapped the first waypoint, OSRM will return one extra leg that duplicates
      // the last leg of the previous chunk. We avoid this by dropping the first leg of the
      // subsequent chunk when we have already stitched something.
      if (stitchedLegs.length > 0 && part.legs.length > 0) {
        stitchedLegs.push(...part.legs.slice(1));
      } else {
        stitchedLegs.push(...part.legs);
      }
    }

    const stitchedFull: LatLngPoint[] = [];
    for (const leg of stitchedLegs) {
      for (const p of leg) stitchedFull.push(p);
    }

    return {
      fullPath: dedupeConsecutive(stitchedFull),
      legs: stitchedLegs,
    };
  })();

  geometryCache.set(key, promise);
  return promise;
};
