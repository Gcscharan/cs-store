import express from "express";
import {
  signup,
  login,
  oauth,
  refresh,
  logout,
} from "../controllers/authController";

const router = express.Router();

// Auth routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/oauth", oauth);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
