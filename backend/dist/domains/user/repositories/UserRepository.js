"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const User_1 = require("../../../models/User");
class UserRepository {
    async findById(userId, session) {
        return await User_1.User.findById(userId).session(session || null);
    }
    async findByIdAndUpdate(userId, updateData, options, session) {
        return await User_1.User.findByIdAndUpdate(userId, updateData, options).session(session || null);
    }
    async findByIdAndDelete(userId, session) {
        return await User_1.User.findByIdAndDelete(userId).session(session || null);
    }
    async save(user, session) {
        return await user.save({ session: session || null });
    }
}
exports.UserRepository = UserRepository;
