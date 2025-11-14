import redisClient from "../../../config/redis";
import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { User } from "../../../models/User";

/**
 * Redis ZSET-based Delivery Partner Load Management Service
 * 
 * Uses Redis Sorted Set (ZSET) for O(log N) delivery partner assignment
 * Structure: delivery_partner_load
 * - Score: currentLoad (number of active orders)
 * - Member: deliveryBoyId (User ID, not DeliveryBoy document ID)
 */
export class DeliveryPartnerLoadService {
  private readonly ZSET_KEY = "delivery_partner_load";
  private readonly ZSET_KEY_BY_VEHICLE = {
    bike: "delivery_partner_load:bike",
    car: "delivery_partner_load:car",
    auto: "delivery_partner_load:auto",
    scooter: "delivery_partner_load:scooter",
    cycle: "delivery_partner_load:cycle",
  };

  /**
   * Initialize ZSET with current delivery partner loads from MongoDB
   * Should be called on server startup
   */
  async initializeLoads(): Promise<void> {
    if (!redisClient.isReady()) {
      console.warn("⚠️  Redis not ready, skipping delivery partner load initialization");
      return;
    }

    try {
      console.log("🚚 Initializing delivery partner loads in Redis...");
      
      // Find all active delivery partners with their current loads
      const deliveryBoys = await DeliveryBoy.find({ isActive: true })
        .populate("userId", "_id vehicleType")
        .select("userId currentLoad");

      if (deliveryBoys.length === 0) {
        console.log("📋 No active delivery partners found");
        return;
      }

      // Clear existing ZSET data
      await this.clearAllLoads();

      let addedCount = 0;
      
      for (const deliveryBoy of deliveryBoys) {
        const userId = (deliveryBoy.userId as any)?._id?.toString();
        if (!userId) continue;

        const currentLoad = deliveryBoy.currentLoad || 0;
        
        // Add to main ZSET
        await this.setLoad(userId, currentLoad);
        
        // Add to vehicle-specific ZSET
        const user = await User.findById(userId).select("deliveryProfile.vehicleType");
        const vehicleType = user?.deliveryProfile?.vehicleType;
        
        if (vehicleType && this.ZSET_KEY_BY_VEHICLE[vehicleType as keyof typeof this.ZSET_KEY_BY_VEHICLE]) {
          await redisClient.set(
            `${this.ZSET_KEY_BY_VEHICLE[vehicleType as keyof typeof this.ZSET_KEY_BY_VEHICLE]}`,
            JSON.stringify({ [userId]: currentLoad }),
            3600
          );
        }
        
        addedCount++;
      }

      console.log(`✅ Initialized ${addedCount} delivery partner loads in Redis`);
      
      // Log current state for debugging
      await this.logCurrentState();
      
    } catch (error) {
      console.error("❌ Failed to initialize delivery partner loads:", error);
    }
  }

  /**
   * Set/update delivery partner load in Redis ZSET
   */
  async setLoad(deliveryBoyId: string, load: number): Promise<boolean> {
    if (!redisClient.isReady()) {
      console.warn(`⚠️  Redis not ready, skipping load set for ${deliveryBoyId}`);
      return false;
    }

    try {
      // Use Redis ZADD to set the score (load) for the member (deliveryBoyId)
      const result = await redisClient.zAdd(this.ZSET_KEY, {
        score: load,
        value: deliveryBoyId,
      });
      
      console.log(`💾 Set load for delivery partner ${deliveryBoyId}: ${load}`);
      return result !== null;
    } catch (error) {
      console.error(`❌ Failed to set load for ${deliveryBoyId}:`, error);
      return false;
    }
  }

  /**
   * Increment delivery partner load (when order is assigned)
   */
  async incrementLoad(deliveryBoyId: string, increment: number = 1): Promise<number | null> {
    if (!redisClient.isReady()) {
      console.warn(`⚠️  Redis not ready, skipping load increment for ${deliveryBoyId}`);
      return null;
    }

    try {
      // Use Redis ZINCRBY to increment the score
      const newLoad = await redisClient.zIncrBy(this.ZSET_KEY, increment, deliveryBoyId);
      
      console.log(`📈 Incremented load for delivery partner ${deliveryBoyId} by ${increment}. New load: ${newLoad}`);
      return newLoad || null;
    } catch (error) {
      console.error(`❌ Failed to increment load for ${deliveryBoyId}:`, error);
      return null;
    }
  }

  /**
   * Decrement delivery partner load (when order is completed)
   */
  async decrementLoad(deliveryBoyId: string, decrement: number = 1): Promise<number | null> {
    if (!redisClient.isReady()) {
      console.warn(`⚠️  Redis not ready, skipping load decrement for ${deliveryBoyId}`);
      return null;
    }

    try {
      // Use Redis ZINCRBY with negative value to decrement
      const newLoad = await redisClient.zIncrBy(this.ZSET_KEY, -decrement, deliveryBoyId);
      
      // Ensure load doesn't go negative
      const finalLoad = Math.max(0, newLoad || 0);
      if (finalLoad !== newLoad && newLoad !== undefined) {
        await this.setLoad(deliveryBoyId, finalLoad);
      }
      
      console.log(`📉 Decremented load for delivery partner ${deliveryBoyId} by ${decrement}. New load: ${finalLoad}`);
      return finalLoad;
    } catch (error) {
      console.error(`❌ Failed to decrement load for ${deliveryBoyId}:`, error);
      return null;
    }
  }

  /**
   * Get delivery partner's current load
   */
  async getLoad(deliveryBoyId: string): Promise<number | null> {
    if (!redisClient.isReady()) {
      return null;
    }

    try {
      const score = await redisClient.zScore(this.ZSET_KEY, deliveryBoyId);
      return score || 0;
    } catch (error) {
      console.error(`❌ Failed to get load for ${deliveryBoyId}:`, error);
      return null;
    }
  }

  /**
   * Get least loaded delivery partners (O(log N) operation)
   */
  async getLeastLoadedPartners(limit: number = 1): Promise<Array<{id: string, load: number}>> {
    if (!redisClient.isReady()) {
      console.warn("⚠️  Redis not ready, falling back to empty result");
      return [];
    }

    try {
      // Use ZRANGE to get partners with lowest scores (loads)
      const result = await redisClient.zRangeWithScores(this.ZSET_KEY, 0, limit - 1);
      
      if (!result || result.length === 0) {
        console.log("📭 No delivery partners found in Redis ZSET");
        return [];
      }

      const partners = result.map(item => ({
        id: item.value,
        load: item.score,
      }));

      console.log(`🎯 Found ${partners.length} least loaded delivery partners:`, 
        partners.map(p => `${p.id}(load:${p.load})`).join(', '));
      
      return partners;
    } catch (error) {
      console.error("❌ Failed to get least loaded partners:", error);
      return [];
    }
  }

  /**
   * Get least loaded delivery partners by vehicle type
   */
  async getLeastLoadedPartnersByVehicle(
    vehicleTypes: string[], 
    limit: number = 1
  ): Promise<Array<{id: string, load: number}>> {
    if (!redisClient.isReady()) {
      console.warn("⚠️  Redis not ready, falling back to MongoDB query");
      return this.fallbackToMongoDB(vehicleTypes, limit);
    }

    try {
      // For now, get all least loaded partners and filter by vehicle type
      // In production, you might want separate ZSETs per vehicle type for better performance
      const allPartners = await this.getLeastLoadedPartners(50); // Get more to filter
      
      if (allPartners.length === 0) {
        return [];
      }

      // Get delivery partners with their vehicle types
      const userIds = allPartners.map(p => p.id);
      const users = await User.find({ 
        _id: { $in: userIds },
        'deliveryProfile.vehicleType': { $in: vehicleTypes }
      }).select('_id deliveryProfile.vehicleType');

      const userVehicleMap = new Map(
        users.map(u => [u._id.toString(), u.deliveryProfile?.vehicleType])
      );

      // Filter and sort by load, then take the limit
      const filteredPartners = allPartners
        .filter(p => userVehicleMap.has(p.id))
        .sort((a, b) => a.load - b.load)
        .slice(0, limit);

      console.log(`🚐 Found ${filteredPartners.length} least loaded partners for vehicle types [${vehicleTypes.join(', ')}]`);
      
      return filteredPartners;
    } catch (error) {
      console.error("❌ Failed to get least loaded partners by vehicle:", error);
      return this.fallbackToMongoDB(vehicleTypes, limit);
    }
  }

  /**
   * Fallback to MongoDB when Redis is unavailable
   */
  private async fallbackToMongoDB(vehicleTypes: string[], limit: number): Promise<Array<{id: string, load: number}>> {
    try {
      console.log("🔄 Falling back to MongoDB for delivery partner lookup");
      
      const users = await User.find({
        role: "delivery",
        'deliveryProfile.vehicleType': { $in: vehicleTypes }
      }).select('_id');

      const userIds = users.map(u => u._id);
      
      const deliveryBoys = await DeliveryBoy.find({
        userId: { $in: userIds },
        isActive: true
      })
      .sort({ currentLoad: 1 })
      .limit(limit)
      .select('userId currentLoad');

      return deliveryBoys.map(db => ({
        id: db.userId?.toString() || '',
        load: db.currentLoad || 0
      })).filter(p => p.id); // Filter out invalid IDs
    } catch (error) {
      console.error("❌ MongoDB fallback failed:", error);
      return [];
    }
  }

  /**
   * Remove delivery partner from load tracking
   */
  async removePartner(deliveryBoyId: string): Promise<boolean> {
    if (!redisClient.isReady()) {
      return false;
    }

    try {
      const result = await redisClient.zRem(this.ZSET_KEY, deliveryBoyId);
      console.log(`🗑️  Removed delivery partner ${deliveryBoyId} from load tracking`);
      return result !== null && result > 0;
    } catch (error) {
      console.error(`❌ Failed to remove partner ${deliveryBoyId}:`, error);
      return false;
    }
  }

  /**
   * Clear all load data (for reinitialization)
   */
  async clearAllLoads(): Promise<boolean> {
    if (!redisClient.isReady()) {
      return false;
    }

    try {
      await redisClient.del(this.ZSET_KEY);
      
      // Clear vehicle-specific ZSETs
      for (const vehicleKey of Object.values(this.ZSET_KEY_BY_VEHICLE)) {
        await redisClient.del(vehicleKey);
      }
      
      console.log("🗑️  Cleared all delivery partner load data");
      return true;
    } catch (error) {
      console.error("❌ Failed to clear load data:", error);
      return false;
    }
  }

  /**
   * Get total number of tracked delivery partners
   */
  async getTotalPartnerCount(): Promise<number> {
    if (!redisClient.isReady()) {
      return 0;
    }

    try {
      const count = await redisClient.zCard(this.ZSET_KEY);
      return count || 0;
    } catch (error) {
      console.error("❌ Failed to get partner count:", error);
      return 0;
    }
  }

  /**
   * Log current state for debugging
   */
  async logCurrentState(): Promise<void> {
    if (!redisClient.isReady()) {
      return;
    }

    try {
      const allPartners = await redisClient.zRangeWithScores(this.ZSET_KEY, 0, -1);
      const totalCount = await this.getTotalPartnerCount();
      
      console.log("📊 Current Delivery Partner Load State:");
      console.log(`   📈 Total Partners: ${totalCount}`);
      
      if (allPartners && allPartners.length > 0) {
        console.log("   🏆 Top 5 Least Loaded:");
        allPartners.slice(0, 5).forEach((partner, index) => {
          console.log(`      ${index + 1}. ID: ${partner.value}, Load: ${partner.score}`);
        });
      }
    } catch (error) {
      console.error("❌ Failed to log current state:", error);
    }
  }

  /**
   * Sync load from MongoDB to Redis for specific delivery partner
   */
  async syncLoadFromMongoDB(deliveryBoyId: string): Promise<boolean> {
    try {
      const deliveryBoy = await DeliveryBoy.findOne({ 
        userId: deliveryBoyId, 
        isActive: true 
      }).select('currentLoad');

      if (!deliveryBoy) {
        console.log(`⚠️  Delivery partner ${deliveryBoyId} not found or inactive`);
        await this.removePartner(deliveryBoyId);
        return false;
      }

      const currentLoad = deliveryBoy.currentLoad || 0;
      await this.setLoad(deliveryBoyId, currentLoad);
      
      console.log(`🔄 Synced load for ${deliveryBoyId}: ${currentLoad}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to sync load for ${deliveryBoyId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const deliveryPartnerLoadService = new DeliveryPartnerLoadService();
