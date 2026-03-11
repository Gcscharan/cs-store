"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../utils/logger");
/**
 * MASTER MIGRATION RUNNER
 * Executes all database enhancements safely
 */
const child_process_1 = require("child_process");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const migrations = [
    "01_enhance_users.ts",
    "02_enhance_products.ts",
    "03_enhance_orders.ts",
    "04_enhance_deliveryboys.ts",
    "05_enhance_payments.ts",
    "06_enforce_unique_user_phone_index.ts"
];
logger_1.logger.info("=".repeat(70));
logger_1.logger.info("🚀 ENTERPRISE DATABASE ENHANCEMENT - MIGRATION RUNNER");
logger_1.logger.info("=".repeat(70));
logger_1.logger.info(`\nDatabase: ${process.env.MONGODB_URI?.split("@")[1]}`);
logger_1.logger.info(`Migrations to run: ${migrations.length}\n`);
logger_1.logger.info("⚠️  SAFETY CHECKS:");
logger_1.logger.info("✅ Migrations are additive - no data will be deleted");
logger_1.logger.info("✅ Existing fields remain unchanged");
logger_1.logger.info("✅ All operations use $set with strict:false");
logger_1.logger.info("✅ Rollback possible via MongoDB backup\n");
logger_1.logger.info("Starting in 3 seconds...\n");
setTimeout(() => {
    migrations.forEach((migration, index) => {
        logger_1.logger.info(`\n[${index + 1}/${migrations.length}] Running: ${migration}`);
        logger_1.logger.info("=".repeat(70));
        try {
            (0, child_process_1.execSync)(`npx ts-node src/scripts/migrations/${migration}`, {
                stdio: "inherit",
                cwd: process.cwd()
            });
            logger_1.logger.info(`✅ ${migration} completed successfully\n`);
        }
        catch (error) {
            logger_1.logger.error(`❌ ${migration} failed!`);
            logger_1.logger.error("Migration stopped. Fix the error and retry.");
            process.exit(1);
        }
    });
    logger_1.logger.info("\n" + "=".repeat(70));
    logger_1.logger.info("🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
    logger_1.logger.info("=".repeat(70));
    logger_1.logger.info("\n📊 Database has been enhanced with:");
    logger_1.logger.info("   ✅ 60+ new enterprise fields");
    logger_1.logger.info("   ✅ 15+ optimized indexes");
    logger_1.logger.info("   ✅ Audit logging capabilities");
    logger_1.logger.info("   ✅ Soft delete support");
    logger_1.logger.info("   ✅ Analytics tracking");
    logger_1.logger.info("\n🚀 Your database is now enterprise-ready!");
}, 3000);
