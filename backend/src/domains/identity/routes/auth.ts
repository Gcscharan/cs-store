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
      error: "OAuth authentication failed",
      message:
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
router.put("/complete-profile", authenticateToken, completeProfile);

// OTP authentication routes
router.post("/send-otp", sendAuthOTP);
router.post("/verify-otp", verifyAuthOTP);

// OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

export default router;
