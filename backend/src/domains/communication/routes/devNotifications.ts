import express from "express";
import { authenticateToken, requireRole } from "../../../middleware/auth";
import { emitDevNotification } from "../controllers/devNotificationController";
import { devTestEmitEvent } from "../controllers/devNotificationTestController";

const router = express.Router();

router.post("/emit", authenticateToken, requireRole(["admin"]), emitDevNotification);
router.post("/test", authenticateToken, requireRole(["admin"]), devTestEmitEvent);

export default router;
