import express from "express";
import passport from "passport";
import { authenticateToken } from "../../../middleware/auth";
import {
  signup,
  login,
  oauth,
  refresh,
  logout,
  googleCallback,
  changePassword,
  sendAuthOTP,
  verifyAuthOTP,
  completeProfile,
  checkPhoneExists,
  getMe,
  deleteAccount,
} from "../controllers/authController";

const router = express.Router();

// Middleware to handle OAuth errors
const handleOAuthError = (
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  if (err && err.name === "TokenError") {
    res.status(400).json({
      message: "OAuth authentication failed",
      details:
        "Invalid OAuth credentials. Please contact support to set up proper OAuth configuration.",
    });
    return;
  }
  next(err);
};

// Auth routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/oauth", oauth);
router.post("/refresh", refresh);
router.post("/logout", authenticateToken, logout);
router.post("/change-password", authenticateToken, changePassword);
router.post("/complete-profile", authenticateToken, completeProfile);
router.put("/complete-profile", authenticateToken, completeProfile);
router.get("/me", authenticateToken, getMe);
router.delete("/delete-account", authenticateToken, deleteAccount);

// OTP authentication routes
router.post("/send-otp", sendAuthOTP);
router.post("/verify-otp", verifyAuthOTP);
router.post("/check-phone", checkPhoneExists);

// OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: "select_account", // Force account selection
    accessType: "offline" // Get refresh token for long-term access (corrected property name)
  })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

export default router;
