"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeAssignmentService = exports.RouteAssignmentService = void 0;
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const User_1 = require("../models/User");
const deliveryPartnerLoadService_1 = require("../domains/operations/services/deliveryPartnerLoadService");
const orderAssignmentController_1 = require("../controllers/orderAssignmentController");
const cvrpRouteAssignmentService_1 = require("./cvrpRouteAssignmentService");
/**
 * Route-based batch assignment service (Amazon/Flipkart style)
 *
 * This service is now a thin wrapper that delegates to CVRP pipeline.
 * Pincode grouping is used only as a pre-filter to narrow candidate orders
 * before passing to the CVRP algorithm.
 */
class RouteAssignmentService {
    /**
     * Main assignment function - assigns all pending orders using CVRP pipeline
     */
    async assignPendingOrders() {
        // Try to use transactions if available (requires replica set)
        let session = null;
        let useTransaction = true;
        try {
            session = await mongoose_1.default.startSession();
            await session.startTransaction();
        }
        catch (error) {
            logger_1.logger.warn("MongoDB transactions not available (requires replica set), continuing without transaction");
            useTransaction = false;
            session = null;
        }
        try {
            // 1. Fetch PACKED orders awaiting delivery assignment
            const query = Order_1.Order.find({
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
            logger_1.logger.info(`[RouteAssignment] Found ${pendingOrders.length} pending orders for CVRP assignment`);
            // 2. Transform orders to CVRP input format
            const orderInputs = [];
            const invalidOrders = [];
            for (const order of pendingOrders) {
                const latRaw = order?.address?.lat;
                const lngRaw = order?.address?.lng;
                if (latRaw === null || latRaw === undefined || lngRaw === null || lngRaw === undefined) {
                    invalidOrders.push(String(order._id));
                    logger_1.logger.warn(`Order ${order._id} missing coordinates, skipping`);
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
            const vehicleInput = { type: "AUTO" };
            let cvrpResult;
            try {
                cvrpResult = cvrpRouteAssignmentService_1.cvrpRouteAssignmentService.computeRoutes(orderInputs, vehicleInput);
            }
            catch (cvrpError) {
                logger_1.logger.error(`[RouteAssignment] CVRP computation failed:`, cvrpError);
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
            logger_1.logger.info(`[RouteAssignment] CVRP computed ${cvrpResult.routes.length} routes for ${cvrpResult.metadata.totalOrders} orders`);
            // 4. Assign delivery boys to routes (pincode-based matching for delivery boy selection)
            const result = {
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
                }
                catch (routeError) {
                    logger_1.logger.error(`[RouteAssignment] Failed to assign route ${route.routeId}:`, routeError);
                    result.failedCount += route.orders.length;
                    result.errors.push(`Route ${route.routeId}: ${routeError.message}`);
                }
            }
            if (useTransaction && session) {
                await session.commitTransaction();
                session.endSession();
            }
            return result;
        }
        catch (error) {
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
    async findDeliveryBoyForRoute(orderCount, pincode, session) {
        // For routes with >= 20 orders (AUTO_CAPACITY_MIN), use auto/car delivery partners
        const autoCapacityMin = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
        if (orderCount >= autoCapacityMin) {
            // Try to find auto/car delivery boy for this pincode
            if (pincode) {
                const pincodeDeliveryBoy = await this.findAutoDeliveryBoyForPincode(pincode, session);
                if (pincodeDeliveryBoy)
                    return pincodeDeliveryBoy;
            }
            // Fall back to any available auto/car delivery boy
            const autoDeliveryBoys = await this.findAutoDeliveryBoysWithLowestLoad(session);
            return autoDeliveryBoys[0] || null;
        }
        else {
            // Small batch - use bike delivery boy
            return this.findBikeDeliveryBoyWithLowestLoad(session);
        }
    }
    /**
     * Find auto/car delivery boy assigned to a specific pincode
     */
    async findAutoDeliveryBoyForPincode(pincode, session) {
        const users = await User_1.User.find({
            role: "delivery",
            "deliveryProfile.assignedAreas": pincode,
        }).lean();
        if (users.length === 0)
            return null;
        const userIds = users.map(u => u._id);
        const query = DeliveryBoy_1.DeliveryBoy.findOne({
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
    groupOrdersByPincode(orders) {
        const pincodeMap = new Map();
        for (const order of orders) {
            const pincode = order.address?.pincode || order.shippingAddress?.zipCode;
            if (!pincode) {
                logger_1.logger.warn(`Order ${order._id} missing pincode, skipping`);
                continue;
            }
            if (!pincodeMap.has(pincode)) {
                pincodeMap.set(pincode, []);
            }
            pincodeMap.get(pincode).push(order);
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
    async findDeliveryBoysForPincode(pincode, session) {
        // Find users with delivery role and this pincode in assignedAreas
        const query1 = User_1.User.find({
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
        const leastLoadedPartners = await deliveryPartnerLoadService_1.deliveryPartnerLoadService.getLeastLoadedPartners(50);
        // Filter to only include partners assigned to this pincode
        const assignedPartnerIds = leastLoadedPartners
            .filter((partner) => userIds.includes(partner.id))
            .map((partner) => partner.id);
        if (assignedPartnerIds.length === 0) {
            logger_1.logger.info(`📭 No delivery partners found for pincode ${pincode} in Redis, falling back to MongoDB`);
            // Fallback to MongoDB if Redis has no data
            const query2 = DeliveryBoy_1.DeliveryBoy.find({
                userId: { $in: userIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) },
                isActive: true,
            }).sort({ currentLoad: 1 });
            return session ? await query2.session(session) : await query2;
        }
        // Get delivery boy documents for the sorted partners (MongoDB verification step)
        const query2 = DeliveryBoy_1.DeliveryBoy.find({
            userId: { $in: assignedPartnerIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) },
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
        const deliveryBoys = (deliveryBoysRaw || []).filter((b) => Boolean(b.userId));
        if (deliveryBoys.length === 0) {
            logger_1.logger.info(`📭 Redis suggested partners for pincode ${pincode}, but none passed DB verification; falling back to MongoDB`);
            const fallbackQuery = DeliveryBoy_1.DeliveryBoy.find({
                userId: { $in: userIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) },
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
        logger_1.logger.info(`🎯 Found ${sortedDeliveryBoys.length} delivery partners for pincode ${pincode} using Redis ZSET`);
        return sortedDeliveryBoys;
    }
    /**
     * Find a delivery boy with bike and lowest current load
     * Uses Redis ZSET for O(log N) performance
     */
    async findBikeDeliveryBoyWithLowestLoad(session) {
        // Use Redis ZSET to get least loaded bike delivery partners
        const leastLoadedPartners = await deliveryPartnerLoadService_1.deliveryPartnerLoadService.getLeastLoadedPartnersByVehicle(['bike'], 1);
        if (leastLoadedPartners.length === 0) {
            logger_1.logger.info("📭 No bike delivery partners found in Redis, falling back to MongoDB");
            // Fallback to MongoDB if Redis has no data
            const query3 = DeliveryBoy_1.DeliveryBoy.findOne({
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
        const query3 = DeliveryBoy_1.DeliveryBoy.findOne({
            userId: new mongoose_1.default.Types.ObjectId(partnerId),
            isActive: true,
        }).populate({
            path: "userId",
            match: { "deliveryProfile.vehicleType": "bike" },
            select: "deliveryProfile.vehicleType",
        });
        const bikeDeliveryBoyRaw = session ? await query3.session(session) : await query3;
        const bikeDeliveryBoy = bikeDeliveryBoyRaw && bikeDeliveryBoyRaw.userId ? bikeDeliveryBoyRaw : null;
        if (!bikeDeliveryBoy) {
            logger_1.logger.info(`📭 Redis suggested bike partner ${partnerId}, but it failed DB verification; falling back to MongoDB`);
            const fallbackQuery = DeliveryBoy_1.DeliveryBoy.findOne({
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
        logger_1.logger.info(`🎯 Found bike delivery partner ${partnerId} with load ${leastLoadedPartners[0].load} using Redis ZSET`);
        return bikeDeliveryBoy;
    }
    /**
     * Find delivery boys with auto/car and lowest current load (for >4 orders)
     * Uses Redis ZSET for O(log N) performance
     */
    async findAutoDeliveryBoysWithLowestLoad(session) {
        // Use Redis ZSET to get least loaded auto/car/scooter delivery partners
        const leastLoadedPartners = await deliveryPartnerLoadService_1.deliveryPartnerLoadService.getLeastLoadedPartnersByVehicle(['car', 'auto', 'scooter'], 10 // Get more partners for distribution
        );
        if (leastLoadedPartners.length === 0) {
            logger_1.logger.info("📭 No auto/car delivery partners found in Redis, falling back to MongoDB");
            // Fallback to MongoDB if Redis has no data
            const query4 = DeliveryBoy_1.DeliveryBoy.find({
                isActive: true,
            }).populate({
                path: 'userId',
                match: { 'deliveryProfile.vehicleType': { $in: ['car', 'auto', 'scooter'] } },
                select: 'deliveryProfile.vehicleType'
            }).sort({ currentLoad: 1 });
            return session ? await query4.session(session) : await query4;
        }
        // Get delivery boy documents for the sorted partners (MongoDB verification step)
        const partnerIds = leastLoadedPartners.map((p) => p.id);
        const query4 = DeliveryBoy_1.DeliveryBoy.find({
            userId: { $in: partnerIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) },
            isActive: true,
        }).populate({
            path: "userId",
            match: { "deliveryProfile.vehicleType": { $in: ["car", "auto", "scooter"] } },
            select: "deliveryProfile.vehicleType",
        });
        const deliveryBoysRaw = session ? await query4.session(session) : await query4;
        const deliveryBoys = (deliveryBoysRaw || []).filter((b) => Boolean(b.userId));
        if (deliveryBoys.length === 0) {
            logger_1.logger.info("📭 Redis suggested auto/car partners, but none passed DB verification; falling back to MongoDB");
            const fallbackQuery = DeliveryBoy_1.DeliveryBoy.find({
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
        logger_1.logger.info(`🎯 Found ${sortedDeliveryBoys.length} auto/car delivery partners using Redis ZSET`);
        return sortedDeliveryBoys;
    }
    /**
     * Select delivery boy with lowest currentLoad from a list
     */
    selectDeliveryBoyByLoad(deliveryBoys) {
        return deliveryBoys.sort((a, b) => a.currentLoad - b.currentLoad)[0];
    }
    /**
     * Distribute orders evenly among delivery boys
     */
    distributeOrdersEvenly(orders, deliveryBoys) {
        // Sort delivery boys by currentLoad (ascending)
        const sortedBoys = [...deliveryBoys].sort((a, b) => a.currentLoad - b.currentLoad);
        const distribution = new Map();
        sortedBoys.forEach((boy) => distribution.set(boy._id, []));
        // Round-robin distribution
        let boyIndex = 0;
        for (const order of orders) {
            const boy = sortedBoys[boyIndex];
            distribution.get(boy._id).push(order);
            boyIndex = (boyIndex + 1) % sortedBoys.length;
        }
        return distribution;
    }
    /**
     * Assign orders to a delivery boy and update database
     */
    async assignOrdersToDeliveryBoy(deliveryBoyId, orders, session) {
        // Assign each order atomically. If another worker already assigned it, this becomes a safe no-op/409.
        for (const o of orders) {
            await (0, orderAssignmentController_1.assignPackedOrderToDeliveryBoy)({
                orderId: String(o._id),
                deliveryBoyId: String(deliveryBoyId),
                actorId: "SYSTEM_ROUTE_ASSIGNER",
            });
        }
        // Keep load service call for backward compatibility (it is Mongo-backed today).
        await deliveryPartnerLoadService_1.deliveryPartnerLoadService.incrementLoad(deliveryBoyId.toString(), orders.length);
    }
}
exports.RouteAssignmentService = RouteAssignmentService;
exports.routeAssignmentService = new RouteAssignmentService();
