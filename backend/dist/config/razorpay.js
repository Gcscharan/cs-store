"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const razorpay_1 = __importDefault(require("razorpay"));
// Razorpay configuration
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RREROYUEXDmjIA",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "ICsVMT4uFvM53f0Czkqr5vmW",
});
console.log("🔑 Razorpay configured with key:", process.env.RAZORPAY_KEY_ID ? "Live Key" : "Test Key");
exports.default = razorpay;
