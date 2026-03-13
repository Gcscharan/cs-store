/**
 * Hub Assignment Service
 * 
 * Implements 2-tier Hub & Spoke delivery model:
 * - Tier 1: Warehouse → Regional Hubs (bulk transfer, truck/van)
 * - Tier 2: Hub → Customer (last-mile CVRP, auto-rickshaw)
 * 
 * Orders within WAREHOUSE_LOCAL_RADIUS_KM are served directly from warehouse.
 * Orders outside local radius are assigned to nearest regional hub.
 */

import { calculateHaversineDistance } from '../utils/routeUtils';

export interface DeliveryHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  pincodes: string[];
}

export interface HubAssignment {
  hubId: string;
  hubName: string;
  tier: 'local' | 'hub';
  depotLat: number;
  depotLng: number;
  distanceFromDepot: number;
}

/**
 * Load hubs from environment variable
 */
export function loadHubs(): DeliveryHub[] {
  try {
    const hubsJson = process.env.DELIVERY_HUBS || '[]';
    return JSON.parse(hubsJson);
  } catch (error) {
    console.warn('[HubAssignment] Failed to parse DELIVERY_HUBS from env:', error);
    return [];
  }
}

// Cached hubs array
export const HUBS: DeliveryHub[] = loadHubs();

/**
 * Get warehouse coordinates from env
 */
export function getWarehouseCoords(): { lat: number; lng: number; pincode: number } {
  return {
    lat: parseFloat(process.env.WAREHOUSE_LAT || '17.094'),
    lng: parseFloat(process.env.WAREHOUSE_LNG || '80.598'),
    pincode: parseInt(process.env.WAREHOUSE_PINCODE || '521235'),
  };
}

/**
 * Get local delivery radius from warehouse
 */
export function getLocalRadiusKm(): number {
  return parseFloat(process.env.WAREHOUSE_LOCAL_RADIUS_KM || '35');
}

/**
 * Assign an order to the appropriate hub or warehouse
 * 
 * @param order - Order with address containing lat/lng
 * @returns HubAssignment with hub details and depot coordinates
 */
export function assignOrderToHub(order: {
  address: { lat: number; lng: number; pincode?: string };
}): HubAssignment {
  const WAREHOUSE = getWarehouseCoords();
  const LOCAL_RADIUS = getLocalRadiusKm();

  const orderCoords = {
    lat: order.address.lat,
    lng: order.address.lng,
  };

  // Check if within local delivery radius of warehouse
  const distFromWarehouse = calculateHaversineDistance(WAREHOUSE, orderCoords);
  
  if (distFromWarehouse <= LOCAL_RADIUS) {
    return {
      hubId: 'warehouse',
      hubName: 'Warehouse (Local)',
      tier: 'local',
      depotLat: WAREHOUSE.lat,
      depotLng: WAREHOUSE.lng,
      distanceFromDepot: distFromWarehouse,
    };
  }

  // Check pincode-based assignment first (more precise)
  const orderPincode = order.address.pincode;
  if (orderPincode) {
    for (const hub of HUBS) {
      if (hub.pincodes && hub.pincodes.includes(orderPincode)) {
        const distFromHub = calculateHaversineDistance(
          { lat: hub.lat, lng: hub.lng },
          orderCoords
        );
        return {
          hubId: hub.id,
          hubName: hub.name,
          tier: 'hub',
          depotLat: hub.lat,
          depotLng: hub.lng,
          distanceFromDepot: distFromHub,
        };
      }
    }
  }

  // Find nearest hub by distance
  if (HUBS.length === 0) {
    // No hubs configured - assign to warehouse anyway (long-haul)
    console.warn('[HubAssignment] No hubs configured, assigning to warehouse');
    return {
      hubId: 'warehouse',
      hubName: 'Warehouse (Long-haul)',
      tier: 'local',
      depotLat: WAREHOUSE.lat,
      depotLng: WAREHOUSE.lng,
      distanceFromDepot: distFromWarehouse,
    };
  }

  let nearestHub = HUBS[0];
  let nearestDist = Infinity;

  for (const hub of HUBS) {
    const dist = calculateHaversineDistance(
      { lat: hub.lat, lng: hub.lng },
      orderCoords
    );
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestHub = hub;
    }
  }

  return {
    hubId: nearestHub.id,
    hubName: nearestHub.name,
    tier: 'hub',
    depotLat: nearestHub.lat,
    depotLng: nearestHub.lng,
    distanceFromDepot: nearestDist,
  };
}

/**
 * Group orders by their assigned hub
 * 
 * @param orders - Array of orders with address data
 * @returns Map of hubId -> orders with hub assignment added
 */
export function groupOrdersByHub(orders: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();

  for (const order of orders) {
    const assignment = assignOrderToHub(order);
    const hubId = assignment.hubId;

    if (!groups.has(hubId)) {
      groups.set(hubId, []);
    }

    groups.get(hubId)!.push({
      ...order,
      hubAssignment: assignment,
    });
  }

  return groups;
}

/**
 * Get hub details by ID
 */
export function getHubById(hubId: string): DeliveryHub | null {
  if (hubId === 'warehouse') {
    const wh = getWarehouseCoords();
    return {
      id: 'warehouse',
      name: 'Warehouse (Local)',
      lat: wh.lat,
      lng: wh.lng,
      radiusKm: getLocalRadiusKm(),
      pincodes: [String(wh.pincode)],
    };
  }
  return HUBS.find(h => h.id === hubId) || null;
}

/**
 * Get all hub IDs including warehouse
 */
export function getAllHubIds(): string[] {
  return ['warehouse', ...HUBS.map(h => h.id)];
}

/**
 * Calculate hub statistics for admin overview
 */
export function getHubStats(): {
  totalHubs: number;
  hubIds: string[];
  hubNames: string[];
} {
  return {
    totalHubs: HUBS.length + 1, // +1 for warehouse
    hubIds: getAllHubIds(),
    hubNames: ['Warehouse (Local)', ...HUBS.map(h => h.name)],
  };
}

export default {
  HUBS,
  loadHubs,
  getWarehouseCoords,
  getLocalRadiusKm,
  assignOrderToHub,
  groupOrdersByHub,
  getHubById,
  getAllHubIds,
  getHubStats,
};
