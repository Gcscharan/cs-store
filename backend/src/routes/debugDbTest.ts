import express from "express";
import mongoose from "mongoose";
import { User } from "../models/User";

const router = express.Router();

router.get("/db-test", async (_req, res) => {
  try {
    const ts = Date.now();
    const email = `debug_${ts}@audit.com`;

    console.log("[DB][DebugRoute] Host:", mongoose.connection.host);
    console.log("[DB][DebugRoute] Database Name:", mongoose.connection.name);
    console.log("[DB][DebugRoute] User.collection.name:", (User as any).collection?.name);

    const created = await User.create({
      name: `Debug ${ts}`,
      email,
      phone: `9${String(ts).slice(-9)}`,
      passwordHash: "__debug__",
      role: "customer",
    });

    const found = await User.findById(created._id).lean();

    console.log("[DB][DebugRoute] Created user:", { id: created._id.toString(), email: created.email });
    console.log("[DB][DebugRoute] Found user:", { id: found ? String((found as any)._id) : null, email: found ? String((found as any).email) : null });

    return res.status(200).json({
      ok: true,
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
      collection: (User as any).collection?.name,
      created: { id: created._id.toString(), email: created.email },
      found: { id: found ? String((found as any)._id) : null, email: found ? String((found as any).email) : null },
    });
  } catch (e: any) {
    console.error("[DB][DebugRoute] Error:", e);
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

    console.log("\n" + "=".repeat(60));
    console.log("=== DEBUG USER ADDRESSES ===");
    console.log("Requested User ID:", userId);
    console.log("Database Name:", mongoose.connection.name);
    console.log("Database Host:", mongoose.connection.host);
    console.log("=".repeat(60));

    const user = await User.findById(userId).lean();

    if (!user) {
      console.log("USER NOT FOUND!");
      return res.status(404).json({
        ok: false,
        error: "User not found",
        dbName: mongoose.connection.name,
        dbHost: mongoose.connection.host,
      });
    }

    console.log("User Found:");
    console.log("  _id:", user._id?.toString());
    console.log("  email:", user.email);
    console.log("  name:", user.name);
    console.log("  Total Addresses:", (user.addresses || []).length);

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
      console.log(`\n  Address [${addr.index}]:`);
      console.log(`    _id: ${addr._id}`);
      console.log(`    label: ${addr.label}`);
      console.log(`    isDefault: ${addr.isDefault}`);
      console.log(`    lat: ${addr.lat} (${addr.latType})`);
      console.log(`    lng: ${addr.lng} (${addr.lngType})`);
    });

    const defaultAddress = (user.addresses || []).find((a: any) => a.isDefault);
    console.log("\n=== DEFAULT ADDRESS (as selected by find) ===");
    if (defaultAddress) {
      console.log("  _id:", (defaultAddress as any)._id?.toString());
      console.log("  lat:", (defaultAddress as any).lat);
      console.log("  lng:", (defaultAddress as any).lng);
    } else {
      console.log("  NO DEFAULT ADDRESS FOUND!");
    }
    console.log("=".repeat(60) + "\n");

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
    console.error("[DB][DebugUser] Error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
