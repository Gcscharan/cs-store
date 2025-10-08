import express from "express";
import passport from "passport";
import {
  signup,
  login,
  oauth,
  refresh,
  logout,
  googleCallback,
  facebookCallback,
} from "../controllers/authController";

const router = express.Router();

// Auth routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/oauth", oauth);
router.post("/refresh", refresh);
router.post("/logout", logout);

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

router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { session: false }),
  facebookCallback
);

export default router;
