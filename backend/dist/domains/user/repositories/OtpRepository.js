"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpRepository = void 0;
const Otp_1 = __importDefault(require("../../../models/Otp"));
class OtpRepository {
    async deleteMany(filter, session) {
        return await Otp_1.default.deleteMany(filter).session(session || null);
    }
}
exports.OtpRepository = OtpRepository;
