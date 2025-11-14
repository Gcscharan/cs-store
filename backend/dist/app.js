"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("passport"));
const errorHandler_1 = require("./middleware/errorHandler");
require("./config/oauth");
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const deliveryFee_1 = __importDefault(require("./routes/deliveryFee"));
const deliveryPersonnel_1 = __importDefault(require("./routes/deliveryPersonnel"));
const pincode_1 = __importDefault(require("./routes/pincode"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const admin_1 = __importDefault(require("./routes/admin"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const cloudinary_1 = __importDefault(require("./routes/cloudinary"));
const user_1 = __importDefault(require("./routes/user"));
const otpRoutes_1 = __importDefault(require("./routes/otpRoutes"));
const paymentRoutes = require("./routes/paymentRoutes");
console.log("App.ts loaded successfully");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.FRONTEND_URL || "http://localhost:3001",
    ],
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(passport_1.default.initialize());
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
app.get("/api/payment/test-direct", (req, res) => {
    res.json({ message: "Direct payment route working!" });
});
app.use("/api/auth", auth_1.default);
app.use("/api/user", user_1.default);
app.use("/api/products", products_1.default);
app.use("/api/cart", cart_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/delivery-fee", deliveryFee_1.default);
app.use("/api/delivery", deliveryPersonnel_1.default);
app.use("/api/pincode", pincode_1.default);
app.use("/api/location", locationRoutes_1.default);
app.use("/api/admin", admin_1.default);
app.use("/api/webhooks", webhooks_1.default);
app.use("/api/cloudinary", cloudinary_1.default);
app.use("/api/payment", paymentRoutes);
app.use("/api/otp", otpRoutes_1.default);
console.log("Payment routes registered successfully");
console.log("OTP routes registered successfully");
app.use("/uploads", express_1.default.static("uploads"));
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map