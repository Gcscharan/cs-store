"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRepository = void 0;
const Payment_1 = require("../../../models/Payment");
class PaymentRepository {
    async deleteMany(filter, session) {
        return await Payment_1.Payment.deleteMany(filter).session(session || null);
    }
}
exports.PaymentRepository = PaymentRepository;
