"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartRepository = void 0;
const Cart_1 = require("../../../models/Cart");
class CartRepository {
    async deleteMany(filter, session) {
        return await Cart_1.Cart.deleteMany(filter).session(session || null);
    }
}
exports.CartRepository = CartRepository;
