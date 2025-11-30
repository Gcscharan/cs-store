import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { User } from "../../../models/User";

/**
 * MongoDB-based Delivery Partner Load Management Service
 * 
 * Uses MongoDB queries for delivery partner assignment
 * No Redis dependency - all operations go directly to MongoDB
 */
export class DeliveryPartnerLoadService {
  
  /**
   * Initialize loads (no-op for MongoDB-only implementation)
   * Previously used to populate Redis ZSET, now data stays in MongoDB
   */
  async initializeLoads(): Promise<void> {
    console.log("🚚 Delivery partner load service initialized (MongoDB-only mode)");
  }

  /**
   * Set/update delivery partner load in MongoDB
   */
  async setLoad(deliveryBoyId: string, load: number): Promise<boolean> {
    try {
      const result = await DeliveryBoy.updateOne(
        { userId: deliveryBoyId },
        { $set: { currentLoad: load } }
      );
      
      console.log(`💾 Set load for delivery partner ${deliveryBoyId}: ${load}`);
      return result.modifiedCount > 0;
    } catch (error) {
      console.error(`❌ Failed to set load for ${deliveryBoyId}:`, error);
      return false;
    }
  }

  /**
   * Increment delivery partner load (when order is assigned)
   */
  async incrementLoad(deliveryBoyId: string, increment: number = 1): Promise<number | null> {
    try {
      const result = await DeliveryBoy.updateOne(
        { userId: deliveryBoyId },
        { $inc: { currentLoad: increment } }
      );

      if (result.modifiedCount === 0) {
        console.warn(`⚠️  Delivery partner ${deliveryBoyId} not found for load increment`);
        return null;
      }

      // Get the new load value
      const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId }).select('currentLoad');
      const newLoad = deliveryBoy?.currentLoad || 0;
      
      console.log(`📈 Incremented load for delivery partner ${deliveryBoyId} by ${increment}. New load: ${newLoad}`);
      return newLoad;
    } catch (error) {
      console.error(`❌ Failed to increment load for ${deliveryBoyId}:`, error);
      return null;
    }
  }

  /**
   * Decrement delivery partner load (when order is completed)
   */
  async decrementLoad(deliveryBoyId: string, decrement: number = 1): Promise<number | null> {
    try {
      // First get current load to ensure we don't go negative
      const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId }).select('currentLoad');
      
      if (!deliveryBoy) {
        console.warn(`⚠️  Delivery partner ${deliveryBoyId} not found for load decrement`);
        return null;
      }

      const currentLoad = deliveryBoy.currentLoad || 0;
      const finalLoad = Math.max(0, currentLoad - decrement);

      // Update with the final load to prevent negative values
      const result = await DeliveryBoy.updateOne(
        { userId: deliveryBoyId },
        { $set: { currentLoad: finalLoad } }
      );

      if (result.modifiedCount === 0) {
        console.warn(`⚠️  No update made for delivery partner ${deliveryBoyId}`);
        return null;
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
    try {
      const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId }).select('currentLoad');
      return deliveryBoy?.currentLoad || 0;
    } catch (error) {
      console.error(`❌ Failed to get load for ${deliveryBoyId}:`, error);
      return null;
    }
  }

  /**
   * Get least loaded delivery partners
   */
  async getLeastLoadedPartners(limit: number = 1): Promise<Array<{id: string, load: number}>> {
    try {
      const deliveryBoys = await DeliveryBoy.find({ isActive: true })
        .sort({ currentLoad: 1 })
        .limit(limit)
        .select('userId currentLoad');

      const partners = deliveryBoys.map(db => ({
        id: db.userId?.toString() || '',
        load: db.currentLoad || 0
      })).filter(p => p.id); // Filter out invalid IDs

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
    try {
      // Find users with specified vehicle types
      const users = await User.find({ 
        'deliveryProfile.vehicleType': { $in: vehicleTypes }
      }).select('_id');

      const userIds = users.map(u => u._id);
      
      // Find delivery boys for those users, sorted by load
      const deliveryBoys = await DeliveryBoy.find({
        userId: { $in: userIds },
        isActive: true
      })
      .sort({ currentLoad: 1 })
      .limit(limit)
      .select('userId currentLoad');

      const partners = deliveryBoys.map(db => ({
        id: db.userId?.toString() || '',
        load: db.currentLoad || 0
      })).filter(p => p.id); // Filter out invalid IDs

      console.log(`🚐 Found ${partners.length} least loaded partners for vehicle types [${vehicleTypes.join(', ')}]`);
      
      return partners;
    } catch (error) {
      console.error("❌ Failed to get least loaded partners by vehicle:", error);
      return [];
    }
  }

  /**
   * Remove delivery partner from load tracking (deactivate)
   */
  async removePartner(deliveryBoyId: string): Promise<boolean> {
    try {
      const result = await DeliveryBoy.updateOne(
        { userId: deliveryBoyId },
        { $set: { isActive: false } }
      );
      
      console.log(`🗑️  Deactivated delivery partner ${deliveryBoyId}`);
      return result.modifiedCount > 0;
    } catch (error) {
      console.error(`❌ Failed to remove partner ${deliveryBoyId}:`, error);
      return false;
    }
  }

  /**
   * Clear all load data (reset all delivery partners to load 0)
   */
  async clearAllLoads(): Promise<boolean> {
    try {
      const result = await DeliveryBoy.updateMany(
        { isActive: true },
        { $set: { currentLoad: 0 } }
      );
      
      console.log(`🗑️  Reset load for ${result.modifiedCount} delivery partners`);
      return true;
    } catch (error) {
      console.error("❌ Failed to clear load data:", error);
      return false;
    }
  }

  /**
   * Get total number of active delivery partners
   */
  async getTotalPartnerCount(): Promise<number> {
    try {
      const count = await DeliveryBoy.countDocuments({ isActive: true });
      return count;
    } catch (error) {
      console.error("❌ Failed to get partner count:", error);
      return 0;
    }
  }

  /**
   * Log current state for debugging
   */
  async logCurrentState(): Promise<void> {
    try {
      const allPartners = await DeliveryBoy.find({ isActive: true })
        .sort({ currentLoad: 1 })
        .limit(10)
        .select('userId currentLoad');
      
      const totalCount = await this.getTotalPartnerCount();
      
      console.log("📊 Current Delivery Partner Load State:");
      console.log(`   📈 Total Active Partners: ${totalCount}`);
      
      if (allPartners.length > 0) {
        console.log("   🏆 Top 5 Least Loaded:");
        allPartners.slice(0, 5).forEach((partner, index) => {
          console.log(`      ${index + 1}. ID: ${partner.userId}, Load: ${partner.currentLoad}`);
        });
      }
    } catch (error) {
      console.error("❌ Failed to log current state:", error);
    }
  }

  /**
   * Sync load from MongoDB (no-op for MongoDB-only implementation)
   * Data is always in MongoDB, so no sync needed
   */
  async syncLoadFromMongoDB(deliveryBoyId: string): Promise<boolean> {
    console.log(`🔄 Sync request for ${deliveryBoyId} - no sync needed (MongoDB-only mode)`);
    return true;
  }
}

// Export singleton instance
export const deliveryPartnerLoadService = new DeliveryPartnerLoadService();
