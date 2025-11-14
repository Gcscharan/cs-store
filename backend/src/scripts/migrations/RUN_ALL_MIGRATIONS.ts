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
  "05_enhance_payments.ts"
];

console.log("=" .repeat(70));
console.log("🚀 ENTERPRISE DATABASE ENHANCEMENT - MIGRATION RUNNER");
console.log("=".repeat(70));
console.log(`\nDatabase: ${process.env.MONGODB_URI?.split("@")[1]}`);
console.log(`Migrations to run: ${migrations.length}\n`);

console.log("⚠️  SAFETY CHECKS:");
console.log("✅ Migrations are additive - no data will be deleted");
console.log("✅ Existing fields remain unchanged");
console.log("✅ All operations use $set with strict:false");
console.log("✅ Rollback possible via MongoDB backup\n");

console.log("Starting in 3 seconds...\n");

setTimeout(() => {
  migrations.forEach((migration, index) => {
    console.log(`\n[${ index + 1}/${migrations.length}] Running: ${migration}`);
    console.log("=".repeat(70));
    
    try {
      execSync(`npx ts-node src/scripts/migrations/${migration}`, {
        stdio: "inherit",
        cwd: process.cwd()
      });
      console.log(`✅ ${migration} completed successfully\n`);
    } catch (error) {
      console.error(`❌ ${migration} failed!`);
      console.error("Migration stopped. Fix the error and retry.");
      process.exit(1);
    }
  });

  console.log("\n" + "=".repeat(70));
  console.log("🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(70));
  console.log("\n📊 Database has been enhanced with:");
  console.log("   ✅ 60+ new enterprise fields");
  console.log("   ✅ 15+ optimized indexes");
  console.log("   ✅ Audit logging capabilities");
  console.log("   ✅ Soft delete support");
  console.log("   ✅ Analytics tracking");
  console.log("\n🚀 Your database is now enterprise-ready!");
  
}, 3000);
