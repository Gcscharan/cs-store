import { DeliveryBoy, IDeliveryBoy } from "../models/DeliveryBoy";
import {
  getRoutePolyline,
  isLocationNearRoute,
  calculateHaversineDistance,
} from "../utils/routeUtils";

export interface AssignmentResult {
  deliveryBoy: IDeliveryBoy;
  reason: "route_match" | "nearest_available";
  distance: number;
  estimatedDuration?: number;
}

/**
 * Smart Order Assignment Service
 * Assigns orders based on route optimization and proximity
 */
export class SmartAssignmentService {
  /**
   * Find the best delivery boy for an order
   * Priority:
   * 1. Delivery boy already on route to nearby location
   * 2. Nearest available delivery boy
   */
  async assignDeliveryBoy(
    orderLocation: { lat: number; lng: number },
    maxConcurrentOrders: number = 3
  ): Promise<AssignmentResult | null> {
    try {
      // Get all available delivery boys
      const availableDeliveryBoys = await DeliveryBoy.find({
        isActive: true,
        availability: { $in: ["available", "busy"] },
        $expr: { $lt: [{ $size: "$assignedOrders" }, maxConcurrentOrders] },
      }).lean();

      if (availableDeliveryBoys.length === 0) {
        console.log("No available delivery boys found");
        return null;
      }

      // Step 1: Check for delivery boys with active routes
      const routeMatch = await this.findRouteMatch(
        orderLocation,
        availableDeliveryBoys
      );

      if (routeMatch) {
        console.log(
          `✅ Route match found: ${routeMatch.deliveryBoy.name} (${routeMatch.reason})`
        );
        return routeMatch;
      }

      // Step 2: Find nearest available delivery boy
      const nearestMatch = this.findNearestDeliveryBoy(
        orderLocation,
        availableDeliveryBoys
      );

      if (nearestMatch) {
        console.log(
          `✅ Nearest delivery boy assigned: ${nearestMatch.deliveryBoy.name} (${nearestMatch.distance.toFixed(2)} km away)`
        );
        return nearestMatch;
      }

      return null;
    } catch (error) {
      console.error("Error in smart assignment:", error);
      return null;
    }
  }

  /**
   * Find delivery boy with active route near the order location
   */
  private async findRouteMatch(
    orderLocation: { lat: number; lng: number },
    deliveryBoys: any[]
  ): Promise<AssignmentResult | null> {
    const ROUTE_THRESHOLD_KM = 2; // 2km corridor

    for (const deliveryBoy of deliveryBoys) {
      // Skip if no active route
      if (!deliveryBoy.activeRoute || !deliveryBoy.activeRoute.polyline) {
        continue;
      }

      // Check if order location is near the delivery boy's current route
      const isNearRoute = isLocationNearRoute(
        orderLocation,
        deliveryBoy.activeRoute.polyline,
        ROUTE_THRESHOLD_KM
      );

      if (isNearRoute) {
        // Calculate distance from current location to order
        const distance = calculateHaversineDistance(
          deliveryBoy.currentLocation,
          orderLocation
        );

        return {
          deliveryBoy,
          reason: "route_match",
          distance,
        };
      }
    }

    return null;
  }

  /**
   * Find nearest available delivery boy
   */
  private findNearestDeliveryBoy(
    orderLocation: { lat: number; lng: number },
    deliveryBoys: any[]
  ): AssignmentResult | null {
    let nearestDeliveryBoy: any = null;
    let minDistance = Infinity;

    for (const deliveryBoy of deliveryBoys) {
      const distance = calculateHaversineDistance(
        deliveryBoy.currentLocation,
        orderLocation
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestDeliveryBoy = deliveryBoy;
      }
    }

    if (nearestDeliveryBoy) {
      return {
        deliveryBoy: nearestDeliveryBoy,
        reason: "nearest_available",
        distance: minDistance,
      };
    }

    return null;
  }

  /**
   * Update delivery boy's active route when order is assigned
   */
  async updateDeliveryBoyRoute(
    deliveryBoyId: string,
    destination: { lat: number; lng: number },
    orderId: string
  ): Promise<void> {
    try {
      const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
      if (!deliveryBoy) {
        console.error("Delivery boy not found");
        return;
      }

      // Get route from current location to destination
      const routeInfo = await getRoutePolyline(
        deliveryBoy.currentLocation,
        destination
      );

      if (routeInfo) {
        // Calculate estimated arrival time
        const estimatedArrival = new Date(
          Date.now() + routeInfo.duration * 1000
        );

        deliveryBoy.activeRoute = {
          polyline: routeInfo.polyline,
          destination,
          orderId: orderId as any,
          startedAt: new Date(),
          estimatedArrival,
        };

        await deliveryBoy.save();

        console.log(
          `✅ Route updated for ${deliveryBoy.name}: ${routeInfo.distance.toFixed(2)} km, ETA: ${routeInfo.duration / 60} mins`
        );
      }
    } catch (error) {
      console.error("Error updating delivery boy route:", error);
    }
  }

  /**
   * Clear delivery boy's active route when delivery is completed
   */
  async clearDeliveryBoyRoute(deliveryBoyId: string): Promise<void> {
    try {
      await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
        $unset: { activeRoute: 1 },
      });

      console.log(`✅ Route cleared for delivery boy ${deliveryBoyId}`);
    } catch (error) {
      console.error("Error clearing delivery boy route:", error);
    }
  }

  /**
   * Get delivery boy's current route information
   */
  async getDeliveryBoyRoute(deliveryBoyId: string): Promise<any | null> {
    try {
      const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId)
        .select("activeRoute currentLocation")
        .lean();

      if (!deliveryBoy || !deliveryBoy.activeRoute) {
        return null;
      }

      return {
        polyline: deliveryBoy.activeRoute.polyline,
        destination: deliveryBoy.activeRoute.destination,
        currentLocation: deliveryBoy.currentLocation,
        estimatedArrival: deliveryBoy.activeRoute.estimatedArrival,
      };
    } catch (error) {
      console.error("Error getting delivery boy route:", error);
      return null;
    }
  }

  /**
   * Calculate scoring for delivery boy assignment
   * Considers: distance, current load, rating (if available)
   */
  private calculateAssignmentScore(
    deliveryBoy: any,
    distance: number,
    isRouteMatch: boolean
  ): number {
    let score = 0;

    // Distance score (50% weight) - closer is better
    const distanceScore = Math.max(0, 100 - distance * 10);
    score += distanceScore * 0.5;

    // Route match bonus (30% weight)
    if (isRouteMatch) {
      score += 30;
    }

    // Load score (20% weight) - fewer orders is better
    const currentLoad = deliveryBoy.assignedOrders?.length || 0;
    const loadScore = Math.max(0, 100 - currentLoad * 33);
    score += loadScore * 0.2;

    return score;
  }
}

// Export singleton instance
export const smartAssignmentService = new SmartAssignmentService();

