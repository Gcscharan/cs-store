"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepository = void 0;
const Notification_1 = __importDefault(require("../../../models/Notification"));
class NotificationRepository {
    async deleteMany(filter, session) {
        return await Notification_1.default.deleteMany(filter).session(session || null);
    }
}
exports.NotificationRepository = NotificationRepository;
