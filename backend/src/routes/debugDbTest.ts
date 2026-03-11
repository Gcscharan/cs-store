import { logger } from '../utils/logger';
import express from "express";
import mongoose from "mongoose";
import { User } from "../models/User";

const router = express.Router();

router.get("/db-test", async (_req, res) => {
  try {
    const ts = Date.now();
    const email = `debug_${ts}@audit.com`;

    logger.info("[DB][DebugRoute] Host:", mongoose.connection.host);
    logger.info("[DB][DebugRoute] Database Name:", mongoose.connection.name);
    logger.info("[DB][DebugRoute] User.collection.name:", (User as any).collection?.name);

    const created = await User.create({
      name: `Debug ${ts}`,
      email,
      phone: `9${String(ts).slice(-9)}`,
      passwordHash: "__debug__",
      role: "customer",
    });

    const found = await User.findById(created._id).lean();

    logger.info("[DB][DebugRoute] Created user:", { id: created._id.toString(), email: created.email });
    logger.info("[DB][DebugRoute] Found user:", { id: found ? String((found as any)._id) : null, email: found ? String((found as any).email) : null });

    return res.status(200).json({
      ok: true,
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
      collection: (User as any).collection?.name,
      created: { id: created._id.toString(), email: created.email },
      found: { id: found ? String((found as any)._id) : null, email: found ? String((found as any).email) : null },
    });
  } catch (e: any) {
    logger.error("[DB][DebugRoute] Error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Debug endpoint to check a specific user's addresses
router.get("/debug-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId format to avoid 500 errors from Schemathesis fuzzing
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid ObjectId format",
        dbName: mongoose.connection.name,
        dbHost: mongoose.connection.host,
      });
    }

    logger.info("\n" + "=".repeat(60));
    logger.info("=== DEBUG USER ADDRESSES ===");
    logger.info("Requested User ID:", userId);
    logger.info("Database Name:", mongoose.connection.name);
    logger.info("Database Host:", mongoose.connection.host);
    logger.info("=".repeat(60));

    const user = await User.findById(userId).lean();

    if (!user) {
      logger.info("USER NOT FOUND!");
      return res.status(404).json({
        ok: false,
        error: "User not found",
        dbName: mongoose.connection.name,
        dbHost: mongoose.connection.host,
      });
    }

    logger.info("User Found:");
    logger.info("  _id:", user._id?.toString());
    logger.info("  email:", user.email);
    logger.info("  name:", user.name);
    logger.info("  Total Addresses:", (user.addresses || []).length);

    const addressesInfo = (user.addresses || []).map((addr: any, idx: number) => ({
      index: idx,
      _id: addr._id?.toString(),
      label: addr.label,
      isDefault: addr.isDefault,
      lat: addr.lat,
      lng: addr.lng,
      latType: typeof addr.lat,
      lngType: typeof addr.lng,
      pincode: addr.pincode,
      city: addr.city,
    }));

    addressesInfo.forEach((addr: any) => {
      logger.info(`\n  Address [${addr.index}]:`);
      logger.info(`    _id: ${addr._id}`);
      logger.info(`    label: ${addr.label}`);
      logger.info(`    isDefault: ${addr.isDefault}`);
      logger.info(`    lat: ${addr.lat} (${addr.latType})`);
      logger.info(`    lng: ${addr.lng} (${addr.lngType})`);
    });

    const defaultAddress = (user.addresses || []).find((a: any) => a.isDefault);
    logger.info("\n=== DEFAULT ADDRESS (as selected by find) ===");
    if (defaultAddress) {
      logger.info("  _id:", (defaultAddress as any)._id?.toString());
      logger.info("  lat:", (defaultAddress as any).lat);
      logger.info("  lng:", (defaultAddress as any).lng);
    } else {
      logger.info("  NO DEFAULT ADDRESS FOUND!");
    }
    logger.info("=".repeat(60) + "\n");

    return res.status(200).json({
      ok: true,
      dbName: mongoose.connection.name,
      dbHost: mongoose.connection.host,
      user: {
        _id: user._id?.toString(),
        email: user.email,
        name: user.name,
        addressesCount: (user.addresses || []).length,
        addresses: addressesInfo,
        defaultAddressId: defaultAddress ? (defaultAddress as any)._id?.toString() : null,
        defaultAddressCoords: defaultAddress
          ? { lat: (defaultAddress as any).lat, lng: (defaultAddress as any).lng }
          : null,
      },
    });
  } catch (e: any) {
    logger.error("[DB][DebugUser] Error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
