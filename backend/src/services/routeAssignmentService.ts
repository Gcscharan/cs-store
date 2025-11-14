import mongoose from "mongoose";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { User } from "../models/User";
import { deliveryPartnerLoadService } from "../domains/operations/services/deliveryPartnerLoadService";

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
 * Groups orders by pincode and assigns to delivery boys based on:
 * 1. Assigned area match
 * 2. Lowest current load
 * 3. Bike availability for unmatched routes
 */
export class RouteAssignmentService {
  /**
   * Main assignment function - assigns all pending orders
   */
  async assignPendingOrders(): Promise<AssignmentResult> {
    // Try to use transactions if available (requires replica set)
    // If not available, work without transactions
    let session: mongoose.ClientSession | null = null;
    let useTransaction = true;

    try {
      session = await mongoose.startSession();
      await session.startTransaction();
    } catch (error: any) {
      console.warn("MongoDB transactions not available (requires replica set), continuing without transaction");
      useTransaction = false;
      session = null;
    }

    try {
      // 1. Fetch all orders awaiting delivery assignment (created or confirmed with unassigned delivery status)
      const query = Order.find({
        $or: [
          { orderStatus: "created", deliveryBoyId: null },
          { orderStatus: "confirmed", deliveryStatus: "unassigned" }
        ]
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

      // 2. Group orders by pincode
      const pincodeBatches = this.groupOrdersByPincode(pendingOrders);

      const result: AssignmentResult = {
        success: true,
        assignedCount: 0,
        failedCount: 0,
        details: [],
        errors: [],
      };

      // 3. Process each pincode batch
      for (const batch of pincodeBatches) {
        try {
          const batchResult = await this.assignBatch(batch, session);
          result.assignedCount += batchResult.assignedCount;
          result.failedCount += batchResult.failedCount;
          result.details.push({
            pincode: batch.pincode,
            ordersAssigned: batchResult.assignedCount,
            deliveryBoys: batchResult.deliveryBoys,
          });
        } catch (error: any) {
          console.error(`Error assigning batch for pincode ${batch.pincode}:`, error);
          result.errors.push(`Pincode ${batch.pincode}: ${error.message}`);
          result.failedCount += batch.orders.length;
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
   * Group orders by pincode
   */
  private groupOrdersByPincode(orders: any[]): PincodeBatch[] {
    const pincodeMap = new Map<string, any[]>();

    for (const order of orders) {
      // Handle missing or undefined pincode
      const pincode = order.address?.pincode || order.shippingAddress?.zipCode;
      
      if (!pincode) {
        console.warn(`Order ${order._id} missing pincode, skipping`);
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
   * Assign a batch of orders for a specific pincode
   */
  private async assignBatch(
    batch: PincodeBatch,
    session: mongoose.ClientSession | null
  ): Promise<{
    assignedCount: number;
    failedCount: number;
    deliveryBoys: string[];
  }> {
    const { pincode, orders } = batch;

    // Find delivery boys whose assigned areas include this pincode
    const matchingDeliveryBoys = await this.findDeliveryBoysForPincode(pincode, session);

    let assignedCount = 0;
    let failedCount = 0;
    const usedDeliveryBoys: string[] = [];

    // Case 1: Batch size <= 4 orders
    if (orders.length <= 4) {
      if (matchingDeliveryBoys.length > 0) {
        // Assign all to the delivery boy with lowest currentLoad
        const selectedBoy = this.selectDeliveryBoyByLoad(matchingDeliveryBoys);
        await this.assignOrdersToDeliveryBoy(selectedBoy._id, orders, session);
        assignedCount = orders.length;
        usedDeliveryBoys.push(selectedBoy.name);
      } else {
        // No matching delivery boy, find one with bike and lowest load
        const bikeDeliveryBoy = await this.findBikeDeliveryBoyWithLowestLoad(session);
        if (bikeDeliveryBoy) {
          await this.assignOrdersToDeliveryBoy(bikeDeliveryBoy._id, orders, session);
          assignedCount = orders.length;
          usedDeliveryBoys.push(bikeDeliveryBoy.name);
        } else {
          failedCount = orders.length;
        }
      }
    }
    // Case 2: Batch size > 4 orders - Use auto/car delivery partners
    else {
      // Find auto/car delivery boys for larger batches
      const autoDeliveryBoys = await this.findAutoDeliveryBoysWithLowestLoad(session);
      
      if (autoDeliveryBoys.length > 0) {
        if (autoDeliveryBoys.length > 1) {
          // Multiple auto delivery boys - distribute evenly
          const distribution = this.distributeOrdersEvenly(orders, autoDeliveryBoys);
          for (const [deliveryBoyId, orderBatch] of distribution) {
            await this.assignOrdersToDeliveryBoy(deliveryBoyId, orderBatch, session);
            const boy = autoDeliveryBoys.find((b) => b._id.equals(deliveryBoyId));
            if (boy) usedDeliveryBoys.push(boy.name);
            assignedCount += orderBatch.length;
          }
        } else {
          // Single auto delivery boy - assign all orders
          const autoDeliveryBoy = autoDeliveryBoys[0];
          await this.assignOrdersToDeliveryBoy(autoDeliveryBoy._id, orders, session);
          assignedCount = orders.length;
          usedDeliveryBoys.push(autoDeliveryBoy.name);
        }
      } else {
        // No auto delivery boys available - fall back to bike delivery boys
        const bikeDeliveryBoy = await this.findBikeDeliveryBoyWithLowestLoad(session);
        if (bikeDeliveryBoy) {
          await this.assignOrdersToDeliveryBoy(bikeDeliveryBoy._id, orders, session);
          assignedCount = orders.length;
          usedDeliveryBoys.push(bikeDeliveryBoy.name);
        } else {
          failedCount = orders.length;
        }
      }
    }

    return {
      assignedCount,
      failedCount,
      deliveryBoys: usedDeliveryBoys,
    };
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

    // Get least loaded delivery partners using Redis ZSET (O(log N))
    const leastLoadedPartners = await deliveryPartnerLoadService.getLeastLoadedPartners(50);
    
    // Filter to only include partners assigned to this pincode
    const assignedPartnerIds = leastLoadedPartners
      .filter((partner: { id: string }) => userIds.includes(partner.id))
      .map((partner: { id: string }) => partner.id);

    if (assignedPartnerIds.length === 0) {
      console.log(`📭 No delivery partners found for pincode ${pincode} in Redis, falling back to MongoDB`);
      // Fallback to MongoDB if Redis has no data
      const query2 = DeliveryBoy.find({
        userId: { $in: userIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
        isActive: true,
      }).sort({ currentLoad: 1 });
      return session ? await query2.session(session) : await query2;
    }

    // Get delivery boy documents for the sorted partners
    const query2 = DeliveryBoy.find({
      userId: { $in: assignedPartnerIds.map(id => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    });
    const deliveryBoys = session ? await query2.session(session) : await query2;

    // Sort delivery boys according to Redis ZSET order
    const sortedDeliveryBoys = deliveryBoys.sort((a, b) => {
      const indexA = assignedPartnerIds.indexOf(a.userId?.toString() || '');
      const indexB = assignedPartnerIds.indexOf(b.userId?.toString() || '');
      return indexA - indexB;
    });

    console.log(`🎯 Found ${sortedDeliveryBoys.length} delivery partners for pincode ${pincode} using Redis ZSET`);
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
      console.log("📭 No bike delivery partners found in Redis, falling back to MongoDB");
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

    // Get the delivery boy document for the least loaded bike partner
    const partnerId = leastLoadedPartners[0].id;
    const query3 = DeliveryBoy.findOne({
      userId: new mongoose.Types.ObjectId(partnerId),
      isActive: true,
    });
    const bikeDeliveryBoy = session ? await query3.session(session) : await query3;

    console.log(`🎯 Found bike delivery partner ${partnerId} with load ${leastLoadedPartners[0].load} using Redis ZSET`);
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
      console.log("📭 No auto/car delivery partners found in Redis, falling back to MongoDB");
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

    // Get delivery boy documents for the sorted partners
    const partnerIds = leastLoadedPartners.map((p: { id: string }) => p.id);
    const query4 = DeliveryBoy.find({
      userId: { $in: partnerIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    });
    const deliveryBoys = session ? await query4.session(session) : await query4;

    // Sort according to Redis ZSET order
    const sortedDeliveryBoys = deliveryBoys.sort((a, b) => {
      const indexA = partnerIds.indexOf(a.userId?.toString() || '');
      const indexB = partnerIds.indexOf(b.userId?.toString() || '');
      return indexA - indexB;
    });

    console.log(`🎯 Found ${sortedDeliveryBoys.length} auto/car delivery partners using Redis ZSET`);
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
    const orderIds = orders.map((o) => o._id);

    // Update orders
    const updateQuery = Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          deliveryBoyId: deliveryBoyId,
          deliveryStatus: "assigned",
          orderStatus: "assigned",
        },
      }
    );
    if (session) {
      await updateQuery.session(session);
    } else {
      await updateQuery;
    }

    // Update delivery boy in MongoDB
    const updateBoyQuery = DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      {
        $push: { assignedOrders: { $each: orderIds } },
        $inc: { currentLoad: orders.length },
      }
    );
    if (session) {
      await updateBoyQuery.session(session);
    } else {
      await updateBoyQuery;
    }

    // Update load in Redis ZSET for O(1) performance
    await deliveryPartnerLoadService.incrementLoad(deliveryBoyId.toString(), orders.length);
    
    console.log(`📈 Updated Redis load for delivery partner ${deliveryBoyId} (+${orders.length} orders)`)
  }
}

export const routeAssignmentService = new RouteAssignmentService();
