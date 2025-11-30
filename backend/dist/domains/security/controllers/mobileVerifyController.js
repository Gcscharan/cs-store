"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMobileOTP = void 0;
const User_1 = require("../../../models/User");
const Otp_1 = __importDefault(require("../../../models/Otp"));
const verifyMobileOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ message: "Phone and OTP are required" });
        }
        const record = await Otp_1.default.findOne({ phone });
        if (!record) {
            return res.status(400).json({ message: "OTP not found" });
        }
        if (record.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        if (record.expiresAt < new Date()) {
            return res.status(400).json({ message: "OTP expired" });
        }
        await User_1.User.updateOne({ phone }, { mobileVerified: true });
        await Otp_1.default.deleteOne({ phone });
        return res.status(200).json({ message: "Mobile verification successful" });
    }
    catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};
exports.verifyMobileOTP = verifyMobileOTP;
