"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileService = void 0;
const UserRepository_1 = require("../repositories/UserRepository");
class UserProfileService {
    constructor() {
        this.userRepository = new UserRepository_1.UserRepository();
    }
    async getUserProfile(userId) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                return null;
            }
            return {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isAdmin: user.isAdmin || false,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            };
        }
        catch (error) {
            console.error("Error fetching user profile:", error);
            throw error;
        }
    }
    async updateUserProfile(userId, updateData) {
        try {
            const updateObj = {};
            if (updateData.name !== undefined)
                updateObj.name = updateData.name;
            if (updateData.phone !== undefined)
                updateObj.phone = updateData.phone;
            if (updateData.email !== undefined)
                updateObj.email = updateData.email;
            const updatedUser = await this.userRepository.findByIdAndUpdate(userId, updateObj, { new: true, runValidators: true, select: "-passwordHash" });
            if (!updatedUser) {
                return null;
            }
            return {
                success: true,
                message: "Profile updated successfully",
                user: {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    role: updatedUser.role,
                },
            };
        }
        catch (error) {
            console.error("Error updating user profile:", error);
            throw error;
        }
    }
}
exports.UserProfileService = UserProfileService;
