/**
 * Daily Settlement Job
 * Runs at midnight IST — settles all riders with pending balance > 0.
 * Uses node-cron (already in dependencies).
 */

import cron from "node-cron";
import { logger } from "../utils/logger";
import { RiderWallet } from "../models/RiderWallet";
import { riderWalletService } from "../services/riderWalletService";

export function startDailySettlementJob(): void {
  // Run at 00:00 IST (18:30 UTC)
  cron.schedule("30 18 * * *", async () => {
    logger.info("[Settlement] Daily auto-settlement job started");

    try {
      // Find all wallets with pending balance
      const wallets = await RiderWallet.find({ pendingBalance: { $gt: 0 } })
        .select("riderId pendingBalance")
        .lean();

      logger.info(`[Settlement] Found ${wallets.length} riders with pending balance`);

      let settled = 0;
      let failed = 0;

      for (const wallet of wallets) {
        try {
          const result = await riderWalletService.settleWallet(wallet.riderId);
          if (result.settled > 0) {
            settled++;
            logger.info(`[Settlement] Rider ${wallet.riderId}: ₹${result.settled} settled`);
          }
        } catch (err) {
          failed++;
          logger.error(`[Settlement] Failed for rider ${wallet.riderId}:`, err);
        }
      }

      logger.info(`[Settlement] Daily job complete — settled: ${settled}, failed: ${failed}`);
    } catch (err) {
      logger.error("[Settlement] Daily job error:", err);
    }
  });

  logger.info("[Settlement] Daily settlement job scheduled (00:00 IST)");
}
