import express from "express";
import passport from "passport";
import { authenticateGoogleAuthOnly, authenticateToken } from "../../../middleware/auth";
import { loginRateLimit, signupRateLimit } from "../../../middleware/security";
import {
  signup,
  login,
  oauth,
  refresh,
  logout,
  googleCallback,
  googleMobileAuth,
  changePassword,
  sendAuthOTP,
  verifyAuthOTP,
  verifyOnboardingOtp,
  completeOnboarding,
  completeProfile,
  checkPhoneExists,
  getMe,
  deleteAccount,
} from "../controllers/authController";

const router = express.Router();

function isGoogleStrategyRegistered(): boolean {
  try {
    return typeof (passport as any)?._strategy === "function" ? !!(passport as any)._strategy("google") : false;
  } catch {
    return false;
  }
}

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
router.post("/signup", signupRateLimit, signup);
router.post("/login", loginRateLimit, login);
router.post("/oauth", oauth);
router.post("/refresh", refresh);
router.post("/logout", authenticateToken, logout);
router.post("/change-password", authenticateToken, changePassword);
router.post("/complete-onboarding", authenticateGoogleAuthOnly, completeOnboarding);
router.post("/verify-onboarding-otp", authenticateGoogleAuthOnly, verifyOnboardingOtp);
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
  (req, res, next) => {
    if (!isGoogleStrategyRegistered()) {
      return res.status(503).json({
        error: "GOOGLE_OAUTH_NOT_CONFIGURED",
        message: "Google OAuth is not configured on this server",
      });
    }
    return next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account", // Force account selection
    accessType: "offline" // Get refresh token for long-term access (corrected property name)
  })
);
router.get(
  "/google/callback",
  (req, res, next) => {
    if (!isGoogleStrategyRegistered()) {
      return res.status(503).json({
        error: "GOOGLE_OAUTH_NOT_CONFIGURED",
        message: "Google OAuth is not configured on this server",
      });
    }
    return next();
  },
  passport.authenticate("google", { session: false }),
  googleCallback
);

// Google Mobile Auth - Token-based for React Native
router.post("/google-mobile", googleMobileAuth);

export default router;
