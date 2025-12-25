"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRepository = void 0;
const Order_1 = require("../../../models/Order");
class OrderRepository {
    async updateMany(filter, update, options, session) {
        return await Order_1.Order.updateMany(filter, update, options || {}).session(session || null);
    }
}
exports.OrderRepository = OrderRepository;
