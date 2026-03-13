import { logger } from '../utils/logger';
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { User } from "../models/User";
import { deliveryPartnerLoadService } from "../domains/operations/services/deliveryPartnerLoadService";
import { assignPackedOrderToDeliveryBoy } from "../controllers/orderAssignmentController";
import { cvrpRouteAssignmentService, OrderInput, VehicleInput, RouteAssignmentResult } from "./cvrpRouteAssignmentService";

interface PincodeBatch {
  pincode: string;
  orders: any[];
}

interface AssignmentResult {
  success: boolean;
  assignedCount: number;
  failedCount: number;
  details: {
    pincode: string;
    ordersAssigned: number;
    deliveryBoys: string[];
  }[];
  errors: string[];
}

/**
 * Route-based batch assignment service (Amazon/Flipkart style)
 * 
 * This service is now a thin wrapper that delegates to CVRP pipeline.
 * Pincode grouping is used only as a pre-filter to narrow candidate orders
 * before passing to the CVRP algorithm.
 */
export class RouteAssignmentService {
  /**
   * Main assignment function - assigns all pending orders using CVRP pipeline
   */
  async assignPendingOrders(): Promise<AssignmentResult> {
    // Try to use transactions if available (requires replica set)
    let session: mongoose.ClientSession | null = null;
    let useTransaction = true;

    try {
      session = await mongoose.startSession();
      await session.startTransaction();
    } catch (error: any) {
      logger.warn("MongoDB transactions not available (requires replica set), continuing without transaction");
      useTransaction = false;
      session = null;
    }

    try {
      // 1. Fetch PACKED orders awaiting delivery assignment
      const query = Order.find({
        orderStatus: { $in: ["PACKED", "packed"] },
        $or: [{ deliveryBoyId: { $exists: false } }, { deliveryBoyId: null }],
      });
      
      const pendingOrders = session ? await query.session(session) : await query;

      if (pendingOrders.length === 0) {
        if (useTransaction && session) {
          await session.commitTransaction();
          session.endSession();
        }
        return {
          success: true,
          assignedCount: 0,
          failedCount: 0,
          details: [],
          errors: ["No pending orders to assign"],
        };
      }

      logger.info(`[RouteAssignment] Found ${pendingOrders.length} pending orders for CVRP assignment`);

      // 2. Transform orders to CVRP input format
      const orderInputs: OrderInput[] = [];
      const invalidOrders: string[] = [];

      for (const order of pendingOrders) {
        const latRaw = order?.address?.lat;
        const lngRaw = order?.address?.lng;
        
        if (latRaw === null || latRaw === undefined || lngRaw === null || lngRaw === undefined) {
          invalidOrders.push(String(order._id));
          logger.warn(`Order ${order._id} missing coordinates, skipping`);
          continue;
        }

        orderInputs.push({
          orderId: String(order._id),
          lat: Number(latRaw),
          lng: Number(lngRaw),
          pincode: order.address?.pincode,
          locality: order.address?.city || order.address?.admin_district,
        });
      }

      if (orderInputs.length === 0) {
        if (useTransaction && session) {
          await session.commitTransaction();
          session.endSession();
        }
        return {
          success: false,
          assignedCount: 0,
          failedCount: pendingOrders.length,
          details: [],
          errors: ["No orders with valid coordinates"],
        };
      }

      // 3. Run CVRP pipeline
      const vehicleInput: VehicleInput = { type: "AUTO" };
      let cvrpResult: RouteAssignmentResult;

      try {
        cvrpResult = cvrpRouteAssignmentService.computeRoutes(orderInputs, vehicleInput);
      } catch (cvrpError: any) {
        logger.error(`[RouteAssignment] CVRP computation failed:`, cvrpError);
        if (useTransaction && session) {
          await session.abortTransaction();
          session.endSession();
        }
        return {
          success: false,
          assignedCount: 0,
          failedCount: pendingOrders.length,
          details: [],
          errors: [`CVRP failed: ${cvrpError.message}`],
        };
      }

      logger.info(`[RouteAssignment] CVRP computed ${cvrpResult.routes.length} routes for ${cvrpResult.metadata.totalOrders} orders`);

      // 4. Assign delivery boys to routes (pincode-based matching for delivery boy selection)
      const result: AssignmentResult = {
        success: true,
        assignedCount: 0,
        failedCount: 0,
        details: [],
        errors: [],
      };

      for (const route of cvrpResult.routes) {
        try {
          // Get pincode from first order for delivery boy matching
          const firstOrder = pendingOrders.find(o => String(o._id) === route.orders[0]);
          const pincode = firstOrder?.address?.pincode;

          // Find delivery boy for this route
          const deliveryBoy = await this.findDeliveryBoyForRoute(route.orders.length, pincode, session);

          if (!deliveryBoy) {
            result.failedCount += route.orders.length;
            result.errors.push(`No delivery boy available for route ${route.routeId} (${route.orders.length} orders)`);
            continue;
          }

          // Assign all orders in this route to the delivery boy
          await this.assignOrdersToDeliveryBoy(deliveryBoy._id, pendingOrders.filter(o => route.orders.includes(String(o._id))), session);
          
          result.assignedCount += route.orders.length;
          result.details.push({
            pincode: pincode || "mixed",
            ordersAssigned: route.orders.length,
            deliveryBoys: [deliveryBoy.name || String(deliveryBoy._id)],
          });
        } catch (routeError: any) {
          logger.error(`[RouteAssignment] Failed to assign route ${route.routeId}:`, routeError);
          result.failedCount += route.orders.length;
          result.errors.push(`Route ${route.routeId}: ${routeError.message}`);
        }
      }

      if (useTransaction && session) {
        await session.commitTransaction();
        session.endSession();
      }

      return result;
    } catch (error: any) {
      if (useTransaction && session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw error;
    }
  }

  /**
   * Find delivery boy for a route based on order count and pincode
   * Uses CVRP capacity constraints (AUTO_CAPACITY_MIN to AUTO_CAPACITY_MAX)
   */
  private async findDeliveryBoyForRoute(
    orderCount: number,
    pincode: string | undefined,
    session: mongoose.ClientSession | null
  ): Promise<any | null> {
    // For routes with >= 20 orders (AUTO_CAPACITY_MIN), use auto/car delivery partners
    const autoCapacityMin = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
    
    if (orderCount >= autoCapacityMin) {
      // Try to find auto/car delivery boy for this pincode
      if (pincode) {
        const pincodeDeliveryBoy = await this.findAutoDeliveryBoyForPincode(pincode, session);
        if (pincodeDeliveryBoy) return pincodeDeliveryBoy;
      }
      
      // Fall back to any available auto/car delivery boy
      const autoDeliveryBoys = await this.findAutoDeliveryBoysWithLowestLoad(session);
      return autoDeliveryBoys[0] || null;
    } else {
      // Small batch - use bike delivery boy
      return this.findBikeDeliveryBoyWithLowestLoad(session);
    }
  }

  /**
   * Find auto/car delivery boy assigned to a specific pincode
   */
  private async findAutoDeliveryBoyForPincode(
    pincode: string,
    session: mongoose.ClientSession | null
  ): Promise<any | null> {
    const users = await User.find({
      role: "delivery",
      "deliveryProfile.assignedAreas": pincode,
    }).lean();

    if (users.length === 0) return null;

    const userIds = users.map(u => u._id);

    const query = DeliveryBoy.findOne({
      userId: { $in: userIds },
      isActive: true,
    }).populate({
      path: "userId",
      match: { "deliveryProfile.vehicleType": { $in: ["car", "auto", "scooter"] } },
    });

    const deliveryBoy = session ? await query.session(session) : await query;
    return deliveryBoy && deliveryBoy.userId ? deliveryBoy : null;
  }

  /**
   * Group orders by pincode (kept for backward compatibility and pre-filtering)
   */
  private groupOrdersByPincode(orders: any[]): PincodeBatch[] {
    const pincodeMap = new Map<string, any[]>();

    for (const order of orders) {
      const pincode = order.address?.pincode || order.shippingAddress?.zipCode;
      
      if (!pincode) {
        logger.warn(`Order ${order._id} missing pincode, skipping`);
        continue;
      }

      if (!pincodeMap.has(pincode)) {
        pincodeMap.set(pincode, []);
      }
      pincodeMap.get(pincode)!.push(order);
    }

    return Array.from(pincodeMap.entries()).map(([pincode, orders]) => ({
      pincode,
      orders,
    }));
  }

  /**
   * Find delivery boys whose assigned areas include the given pincode
   * Uses Redis ZSET for O(log N) load-based sorting
   */
  private async findDeliveryBoysForPincode(
    pincode: string,
    session: mongoose.ClientSession | null
  ): Promise<any[]> {
    // Find users with delivery role and this pincode in assignedAreas
    const query1 = User.find({
      role: "delivery",
      "deliveryProfile.assignedAreas": pincode,
    });
    const users = session ? await query1.session(session) : await query1;

    const userIds = users.map((u) => u._id.toString());

    if (userIds.length === 0) {
      return [];
    }

    // Redis is advisory only; MongoDB is authoritative and must verify eligibility.
    // Get least loaded delivery partners using Redis ZSET (O(log N))
    const leastLoadedPartners = await deliveryPartnerLoadService.getLeastLoadedPartners(50);
    
    // Filter to only include partners assigned to this pincode
    const assignedPartnerIds = leastLoadedPartners
      .filter((partner: { id: string }) => userIds.includes(partner.id))
      .map((partner: { id: string }) => partner.id);

    if (assignedPartnerIds.length === 0) {
      logger.info(`📭 No delivery partners found for pincode ${pincode} in Redis, falling back to MongoDB`);
      // Fallback to MongoDB if Redis has no data
      const query2 = DeliveryBoy.find({
        userId: { $in: userIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
        isActive: true,
      }).sort({ currentLoad: 1 });
      return session ? await query2.session(session) : await query2;
    }

    // Get delivery boy documents for the sorted partners (MongoDB verification step)
    const query2 = DeliveryBoy.find({
      userId: { $in: assignedPartnerIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    }).populate({
      path: "userId",
      match: {
        role: "delivery",
        "deliveryProfile.assignedAreas": pincode,
      },
      select: "role deliveryProfile.assignedAreas",
    });
    const deliveryBoysRaw = session ? await query2.session(session) : await query2;

    const deliveryBoys = (deliveryBoysRaw || []).filter((b: any) => Boolean(b.userId));

    if (deliveryBoys.length === 0) {
      logger.info(
        `📭 Redis suggested partners for pincode ${pincode}, but none passed DB verification; falling back to MongoDB`
      );
      const fallbackQuery = DeliveryBoy.find({
        userId: { $in: userIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
        isActive: true,
      }).sort({ currentLoad: 1 });
      return session ? await fallbackQuery.session(session) : await fallbackQuery;
    }

    // Sort delivery boys according to Redis ZSET order
    const sortedDeliveryBoys = deliveryBoys.sort((a, b) => {
      const indexA = assignedPartnerIds.indexOf(a.userId?.toString() || '');
      const indexB = assignedPartnerIds.indexOf(b.userId?.toString() || '');
      return indexA - indexB;
    });

    logger.info(`🎯 Found ${sortedDeliveryBoys.length} delivery partners for pincode ${pincode} using Redis ZSET`);
    return sortedDeliveryBoys;
  }

  /**
   * Find a delivery boy with bike and lowest current load
   * Uses Redis ZSET for O(log N) performance
   */
  private async findBikeDeliveryBoyWithLowestLoad(
    session: mongoose.ClientSession | null
  ): Promise<any | null> {
    // Use Redis ZSET to get least loaded bike delivery partners
    const leastLoadedPartners = await deliveryPartnerLoadService.getLeastLoadedPartnersByVehicle(['bike'], 1);
    
    if (leastLoadedPartners.length === 0) {
      logger.info("📭 No bike delivery partners found in Redis, falling back to MongoDB");
      // Fallback to MongoDB if Redis has no data
      const query3 = DeliveryBoy.findOne({
        isActive: true,
      }).populate({
        path: 'userId',
        match: { 'deliveryProfile.vehicleType': 'bike' },
        select: 'deliveryProfile.vehicleType'
      }).sort({ currentLoad: 1 });
      return session ? await query3.session(session) : await query3;
    }

    // Get the delivery boy document for the least loaded bike partner (MongoDB verification step)
    const partnerId = leastLoadedPartners[0].id;
    const query3 = DeliveryBoy.findOne({
      userId: new mongoose.Types.ObjectId(partnerId),
      isActive: true,
    }).populate({
      path: "userId",
      match: { "deliveryProfile.vehicleType": "bike" },
      select: "deliveryProfile.vehicleType",
    });
    const bikeDeliveryBoyRaw = session ? await query3.session(session) : await query3;

    const bikeDeliveryBoy = bikeDeliveryBoyRaw && bikeDeliveryBoyRaw.userId ? bikeDeliveryBoyRaw : null;

    if (!bikeDeliveryBoy) {
      logger.info(
        `📭 Redis suggested bike partner ${partnerId}, but it failed DB verification; falling back to MongoDB`
      );
      const fallbackQuery = DeliveryBoy.findOne({
        isActive: true,
      })
        .populate({
          path: "userId",
          match: { "deliveryProfile.vehicleType": "bike" },
          select: "deliveryProfile.vehicleType",
        })
        .sort({ currentLoad: 1 });
      return session ? await fallbackQuery.session(session) : await fallbackQuery;
    }

    logger.info(`🎯 Found bike delivery partner ${partnerId} with load ${leastLoadedPartners[0].load} using Redis ZSET`);
    return bikeDeliveryBoy;
  }

  /**
   * Find delivery boys with auto/car and lowest current load (for >4 orders)
   * Uses Redis ZSET for O(log N) performance
   */
  private async findAutoDeliveryBoysWithLowestLoad(
    session: mongoose.ClientSession | null
  ): Promise<any[]> {
    // Use Redis ZSET to get least loaded auto/car/scooter delivery partners
    const leastLoadedPartners = await deliveryPartnerLoadService.getLeastLoadedPartnersByVehicle(
      ['car', 'auto', 'scooter'], 
      10 // Get more partners for distribution
    );
    
    if (leastLoadedPartners.length === 0) {
      logger.info("📭 No auto/car delivery partners found in Redis, falling back to MongoDB");
      // Fallback to MongoDB if Redis has no data
      const query4 = DeliveryBoy.find({
        isActive: true,
      }).populate({
        path: 'userId',
        match: { 'deliveryProfile.vehicleType': { $in: ['car', 'auto', 'scooter'] } },
        select: 'deliveryProfile.vehicleType'
      }).sort({ currentLoad: 1 });
      return session ? await query4.session(session) : await query4;
    }

    // Get delivery boy documents for the sorted partners (MongoDB verification step)
    const partnerIds = leastLoadedPartners.map((p: { id: string }) => p.id);
    const query4 = DeliveryBoy.find({
      userId: { $in: partnerIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    }).populate({
      path: "userId",
      match: { "deliveryProfile.vehicleType": { $in: ["car", "auto", "scooter"] } },
      select: "deliveryProfile.vehicleType",
    });
    const deliveryBoysRaw = session ? await query4.session(session) : await query4;
    const deliveryBoys = (deliveryBoysRaw || []).filter((b: any) => Boolean(b.userId));

    if (deliveryBoys.length === 0) {
      logger.info("📭 Redis suggested auto/car partners, but none passed DB verification; falling back to MongoDB");
      const fallbackQuery = DeliveryBoy.find({
        isActive: true,
      })
        .populate({
          path: "userId",
          match: { "deliveryProfile.vehicleType": { $in: ["car", "auto", "scooter"] } },
          select: "deliveryProfile.vehicleType",
        })
        .sort({ currentLoad: 1 });
      return session ? await fallbackQuery.session(session) : await fallbackQuery;
    }

    // Sort according to Redis ZSET order
    const sortedDeliveryBoys = deliveryBoys.sort((a, b) => {
      const indexA = partnerIds.indexOf(a.userId?.toString() || '');
      const indexB = partnerIds.indexOf(b.userId?.toString() || '');
      return indexA - indexB;
    });

    logger.info(`🎯 Found ${sortedDeliveryBoys.length} auto/car delivery partners using Redis ZSET`);
    return sortedDeliveryBoys;
  }

  /**
   * Select delivery boy with lowest currentLoad from a list
   */
  private selectDeliveryBoyByLoad(deliveryBoys: any[]): any {
    return deliveryBoys.sort((a, b) => a.currentLoad - b.currentLoad)[0];
  }

  /**
   * Distribute orders evenly among delivery boys
   */
  private distributeOrdersEvenly(
    orders: any[],
    deliveryBoys: any[]
  ): Map<mongoose.Types.ObjectId, any[]> {
    // Sort delivery boys by currentLoad (ascending)
    const sortedBoys = [...deliveryBoys].sort(
      (a, b) => a.currentLoad - b.currentLoad
    );

    const distribution = new Map<mongoose.Types.ObjectId, any[]>();
    sortedBoys.forEach((boy) => distribution.set(boy._id, []));

    // Round-robin distribution
    let boyIndex = 0;
    for (const order of orders) {
      const boy = sortedBoys[boyIndex];
      distribution.get(boy._id)!.push(order);
      boyIndex = (boyIndex + 1) % sortedBoys.length;
    }

    return distribution;
  }

  /**
   * Assign orders to a delivery boy and update database
   */
  private async assignOrdersToDeliveryBoy(
    deliveryBoyId: mongoose.Types.ObjectId,
    orders: any[],
    session: mongoose.ClientSession | null
  ): Promise<void> {
    // Assign each order atomically. If another worker already assigned it, this becomes a safe no-op/409.
    for (const o of orders) {
      await assignPackedOrderToDeliveryBoy({
        orderId: String(o._id),
        deliveryBoyId: String(deliveryBoyId),
        actorId: "SYSTEM_ROUTE_ASSIGNER",
      });
    }

    // Keep load service call for backward compatibility (it is Mongo-backed today).
    await deliveryPartnerLoadService.incrementLoad(deliveryBoyId.toString(), orders.length);
  }
}

export const routeAssignmentService = new RouteAssignmentService();
