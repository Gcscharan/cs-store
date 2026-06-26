import express from "express";
import { authenticateToken, requireRole } from "../../../middleware/auth";
import { emitDevNotification } from "../controllers/devNotificationController";
import { devTestEmitEvent } from "../controllers/devNotificationTestController";
import { sendDemoNotification } from "../controllers/devNotificationDemoController";

const router = express.Router();

router.post("/emit", authenticateToken, requireRole(["admin"]), emitDevNotification);
router.post("/test", authenticateToken, requireRole(["admin"]), devTestEmitEvent);
router.post("/demo", authenticateToken, requireRole(["admin"]), sendDemoNotification);

export default router;
