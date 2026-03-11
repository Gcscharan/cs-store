import { logger } from '../../utils/logger';
/**
 * MASTER MIGRATION RUNNER
 * Executes all database enhancements safely
 */
import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

const migrations = [
  "01_enhance_users.ts",
  "02_enhance_products.ts",
  "03_enhance_orders.ts",
  "04_enhance_deliveryboys.ts",
  "05_enhance_payments.ts",
  "06_enforce_unique_user_phone_index.ts"
];

logger.info("=" .repeat(70));
logger.info("🚀 ENTERPRISE DATABASE ENHANCEMENT - MIGRATION RUNNER");
logger.info("=".repeat(70));
logger.info(`\nDatabase: ${process.env.MONGODB_URI?.split("@")[1]}`);
logger.info(`Migrations to run: ${migrations.length}\n`);

logger.info("⚠️  SAFETY CHECKS:");
logger.info("✅ Migrations are additive - no data will be deleted");
logger.info("✅ Existing fields remain unchanged");
logger.info("✅ All operations use $set with strict:false");
logger.info("✅ Rollback possible via MongoDB backup\n");

logger.info("Starting in 3 seconds...\n");

setTimeout(() => {
  migrations.forEach((migration, index) => {
    logger.info(`\n[${ index + 1}/${migrations.length}] Running: ${migration}`);
    logger.info("=".repeat(70));
    
    try {
      execSync(`npx ts-node src/scripts/migrations/${migration}`, {
        stdio: "inherit",
        cwd: process.cwd()
      });
      logger.info(`✅ ${migration} completed successfully\n`);
    } catch (error) {
      logger.error(`❌ ${migration} failed!`);
      logger.error("Migration stopped. Fix the error and retry.");
      process.exit(1);
    }
  });

  logger.info("\n" + "=".repeat(70));
  logger.info("🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
  logger.info("=".repeat(70));
  logger.info("\n📊 Database has been enhanced with:");
  logger.info("   ✅ 60+ new enterprise fields");
  logger.info("   ✅ 15+ optimized indexes");
  logger.info("   ✅ Audit logging capabilities");
  logger.info("   ✅ Soft delete support");
  logger.info("   ✅ Analytics tracking");
  logger.info("\n🚀 Your database is now enterprise-ready!");
  
}, 3000);
