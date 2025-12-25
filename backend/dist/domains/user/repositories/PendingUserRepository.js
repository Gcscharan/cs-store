"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingUserRepository = void 0;
const PendingUser_1 = require("../../../models/PendingUser");
class PendingUserRepository {
    async findOne(filter, session) {
        return await PendingUser_1.PendingUser.findOne(filter).session(session || null);
    }
    async deleteOne(filter, session) {
        return await PendingUser_1.PendingUser.deleteOne(filter).session(session || null);
    }
}
exports.PendingUserRepository = PendingUserRepository;
