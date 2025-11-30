"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const auth_1 = require("../../../middleware/auth");
const authController_1 = require("../controllers/authController");
const router = express_1.default.Router();
// Middleware to handle OAuth errors
const handleOAuthError = (err, req, res, next) => {
    if (err && err.name === "TokenError") {
        res.status(400).json({
            message: "OAuth authentication failed",
            details: "Invalid OAuth credentials. Please contact support to set up proper OAuth configuration.",
        });
        return;
    }
    next(err);
};
// Auth routes
router.post("/signup", authController_1.signup);
router.post("/login", authController_1.login);
router.post("/oauth", authController_1.oauth);
router.post("/refresh", authController_1.refresh);
router.post("/logout", auth_1.authenticateToken, authController_1.logout);
router.post("/change-password", auth_1.authenticateToken, authController_1.changePassword);
router.post("/complete-profile", auth_1.authenticateToken, authController_1.completeProfile);
router.put("/complete-profile", auth_1.authenticateToken, authController_1.completeProfile);
router.get("/me", auth_1.authenticateToken, authController_1.getMe);
router.delete("/delete-account", auth_1.authenticateToken, authController_1.deleteAccount);
// OTP authentication routes
router.post("/send-otp", authController_1.sendAuthOTP);
router.post("/verify-otp", authController_1.verifyAuthOTP);
router.post("/check-phone", authController_1.checkPhoneExists);
// OAuth routes
router.get("/google", passport_1.default.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account", // Force account selection
    accessType: "offline" // Get refresh token for long-term access (corrected property name)
}));
router.get("/google/callback", passport_1.default.authenticate("google", { session: false }), authController_1.googleCallback);
exports.default = router;
