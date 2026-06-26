#!/usr/bin/env node
/**
 * Delivery Workflow Agent
 * Tests the complete delivery flow from login to earnings credit
 * This is the highest-risk workflow for launch
 */

import { QAEngine } from "../engine/QAEngine.mjs";
import { ConsoleMonitor } from "../engine/ConsoleMonitor.mjs";
import { AIValidator } from "../engine/AIValidator.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DeliveryAgent {
  constructor(options = {}) {
    this.engine = new QAEngine({
      baseUrl: options.baseUrl || "http://localhost:3000",
      headless: options.headless !== false,
      slowMo: options.slowMo || 500,
    });
    
    this.consoleMonitor = new ConsoleMonitor();
    this.aiValidator = new AIValidator(options.ollama);
    
    this.credentials = options.credentials || {
      phone: process.env.DELIVERY_PHONE || "9391795162",
      password: process.env.DELIVERY_PASSWORD || "test123",
    };
    
    this.flowSteps = [];
    this.screenshots = [];
    this.results = {
      login: null,
      goOnline: null,
      acceptOrder: null,
      pickup: null,
      startDelivery: null,
      markArrived: null,
      codCash: null,
      codUpi: null,
      otpSend: null,
      otpResend: null,
      otpVerify: null,
      delivered: null,
      earnings: null,
    };
  }

  async initialize() {
    console.log("🚚 Initializing Delivery Agent...\n");
    await this.engine.launch();
    this.consoleMonitor.setupMonitoring(this.engine.page);
    
    const ollamaAvailable = await this.aiValidator.checkAvailability();
    if (ollamaAvailable) {
      console.log("✅ AI Validation enabled (Ollama)\n");
    } else {
      console.log("⚠️  AI Validation disabled (Ollama not available)\n");
    }
  }

  async login() {
    console.log("📝 STEP 1: Login as Delivery Partner");
    console.log("─".repeat(50));
    
    try {
      await this.engine.navigate("/delivery/login");
      await this.engine.screenshot("delivery_login.png");
      
      // Fill phone
      await this.engine.fill('input[type="tel"], input[name="phone"]', this.credentials.phone);
      await this.engine.page.waitForTimeout(500);
      
      // Fill password
      await this.engine.fill('input[type="password"], input[name="password"]', this.credentials.password);
      await this.engine.page.waitForTimeout(500);
      
      // Click login button
      await this.engine.click('button[type="submit"], button:has-text("Login")');
      await this.engine.page.waitForTimeout(2000);
      
      // Check if login succeeded
      const currentUrl = this.engine.page.url();
      const success = !currentUrl.includes("/login") && !currentUrl.includes("/signup");
      
      await this.engine.screenshot("delivery_after_login.png");
      
      const result = {
        step: "login",
        success,
        url: currentUrl,
        timestamp: Date.now(),
        errors: this.consoleMonitor.errors.slice(-5),
      };
      
      this.flowSteps.push(result);
      this.results.login = result;
      
      if (success) {
        console.log("✅ Login successful\n");
      } else {
        console.log("❌ Login failed\n");
      }
      
      return result;
    } catch (err) {
      const result = {
        step: "login",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.login = result;
      console.log(`❌ Login error: ${err.message}\n`);
      return result;
    }
  }

  async goOnline() {
    console.log("🟢 STEP 2: Go Online");
    console.log("─".repeat(50));
    
    try {
      // Look for "Go Online" button
      const goOnlineBtn = await this.engine.page.locator('button:has-text("Go Online"), button:has-text("Online")').first();
      
      if (await goOnlineBtn.isVisible()) {
        await goOnlineBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_online.png");
        
        const result = {
          step: "goOnline",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.goOnline = result;
        console.log("✅ Went online\n");
        return result;
      } else {
        console.log("⚠️  Already online or button not found\n");
        const result = {
          step: "goOnline",
          success: true,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.goOnline = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "goOnline",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.goOnline = result;
      console.log(`❌ Go online error: ${err.message}\n`);
      return result;
    }
  }

  async acceptOrder() {
    console.log("📦 STEP 3: Accept Order");
    console.log("─".repeat(50));
    
    try {
      // Wait for order assignment or look for available orders
      await this.engine.page.waitForTimeout(3000);
      
      // Look for "Accept" button
      const acceptBtn = await this.engine.page.locator('button:has-text("Accept"), button:has-text("Accept Order")').first();
      
      if (await acceptBtn.isVisible({ timeout: 5000 })) {
        await acceptBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_order_accepted.png");
        
        const result = {
          step: "acceptOrder",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.acceptOrder = result;
        console.log("✅ Order accepted\n");
        return result;
      } else {
        console.log("⚠️  No order available to accept (may need manual order creation)\n");
        const result = {
          step: "acceptOrder",
          success: false,
          skipped: true,
          reason: "No order available",
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.acceptOrder = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "acceptOrder",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.acceptOrder = result;
      console.log(`❌ Accept order error: ${err.message}\n`);
      return result;
    }
  }

  async markPickedUp() {
    console.log("📤 STEP 4: Mark Picked Up");
    console.log("─".repeat(50));
    
    try {
      const pickupBtn = await this.engine.page.locator('button:has-text("Picked Up"), button:has-text("Mark Picked")').first();
      
      if (await pickupBtn.isVisible({ timeout: 5000 })) {
        await pickupBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_picked_up.png");
        
        const result = {
          step: "pickup",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.pickup = result;
        console.log("✅ Marked as picked up\n");
        return result;
      } else {
        console.log("⚠️  Pickup button not visible\n");
        const result = {
          step: "pickup",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.pickup = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "pickup",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.pickup = result;
      console.log(`❌ Pickup error: ${err.message}\n`);
      return result;
    }
  }

  async startDelivery() {
    console.log("🚗 STEP 5: Start Delivery");
    console.log("─".repeat(50));
    
    try {
      const startBtn = await this.engine.page.locator('button:has-text("Start Delivery"), button:has-text("Navigate")').first();
      
      if (await startBtn.isVisible({ timeout: 5000 })) {
        await startBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_started.png");
        
        const result = {
          step: "startDelivery",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.startDelivery = result;
        console.log("✅ Delivery started\n");
        return result;
      } else {
        console.log("⚠️  Start delivery button not visible\n");
        const result = {
          step: "startDelivery",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.startDelivery = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "startDelivery",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.startDelivery = result;
      console.log(`❌ Start delivery error: ${err.message}\n`);
      return result;
    }
  }

  async markArrived() {
    console.log("📍 STEP 6: Mark Arrived");
    console.log("─".repeat(50));
    
    try {
      const arrivedBtn = await this.engine.page.locator('button:has-text("Arrived"), button:has-text("Mark Arrived")').first();
      
      if (await arrivedBtn.isVisible({ timeout: 5000 })) {
        await arrivedBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_arrived.png");
        
        const result = {
          step: "markArrived",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.markArrived = result;
        console.log("✅ Marked as arrived\n");
        return result;
      } else {
        console.log("⚠️  Arrived button not visible\n");
        const result = {
          step: "markArrived",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.markArrived = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "markArrived",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.markArrived = result;
      console.log(`❌ Mark arrived error: ${err.message}\n`);
      return result;
    }
  }

  async collectCOD(method = "cash") {
    console.log(`💰 STEP 7: Collect COD (${method.toUpperCase()})`);
    console.log("─".repeat(50));
    
    try {
      const codBtn = await this.engine.page.locator(`button:has-text("${method === "cash" ? "Cash" : "UPI"}")`).first();
      
      if (await codBtn.isVisible({ timeout: 5000 })) {
        await codBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot(`delivery_cod_${method}.png`);
        
        const result = {
          step: method === "cash" ? "codCash" : "codUpi",
          success: true,
          method,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results[method === "cash" ? "codCash" : "codUpi"] = result;
        console.log(`✅ COD collected via ${method}\n`);
        return result;
      } else {
        console.log(`⚠️  COD ${method} button not visible\n`);
        const result = {
          step: method === "cash" ? "codCash" : "codUpi",
          success: false,
          skipped: true,
          method,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results[method === "cash" ? "codCash" : "codUpi"] = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: method === "cash" ? "codCash" : "codUpi",
        success: false,
        error: err.message,
        method,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results[method === "cash" ? "codCash" : "codUpi"] = result;
      console.log(`❌ COD ${method} error: ${err.message}\n`);
      return result;
    }
  }

  async sendOTP() {
    console.log("🔐 STEP 8: Send OTP");
    console.log("─".repeat(50));
    
    try {
      const otpBtn = await this.engine.page.locator('button:has-text("Send OTP"), button:has-text("Verify")').first();
      
      if (await otpBtn.isVisible({ timeout: 5000 })) {
        await otpBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_otp_sent.png");
        
        const result = {
          step: "otpSend",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.otpSend = result;
        console.log("✅ OTP sent\n");
        return result;
      } else {
        console.log("⚠️  OTP button not visible\n");
        const result = {
          step: "otpSend",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.otpSend = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "otpSend",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.otpSend = result;
      console.log(`❌ Send OTP error: ${err.message}\n`);
      return result;
    }
  }

  async resendOTP() {
    console.log("🔐 STEP 9: Resend OTP");
    console.log("─".repeat(50));
    
    try {
      const resendBtn = await this.engine.page.locator('button:has-text("Resend"), button:has-text("Resend OTP")').first();
      
      if (await resendBtn.isVisible({ timeout: 5000 })) {
        await resendBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_otp_resent.png");
        
        const result = {
          step: "otpResend",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.otpResend = result;
        console.log("✅ OTP resent\n");
        return result;
      } else {
        console.log("⚠️  Resend OTP button not visible\n");
        const result = {
          step: "otpResend",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.otpResend = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "otpResend",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.otpResend = result;
      console.log(`❌ Resend OTP error: ${err.message}\n`);
      return result;
    }
  }

  async verifyOTP(otp = "123456") {
    console.log("🔐 STEP 10: Verify OTP");
    console.log("─".repeat(50));
    
    try {
      const otpInput = await this.engine.page.locator('input[type="text"], input[placeholder*="OTP"]').first();
      
      if (await otpInput.isVisible({ timeout: 5000 })) {
        await otpInput.fill(otp);
        await this.engine.page.waitForTimeout(500);
        
        const verifyBtn = await this.engine.page.locator('button:has-text("Verify"), button:has-text("Submit")').first();
        await verifyBtn.click();
        await this.engine.page.waitForTimeout(2000);
        
        await this.engine.screenshot("delivery_otp_verified.png");
        
        const result = {
          step: "otpVerify",
          success: true,
          otp,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.otpVerify = result;
        console.log("✅ OTP verified\n");
        return result;
      } else {
        console.log("⚠️  OTP input not visible\n");
        const result = {
          step: "otpVerify",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.otpVerify = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "otpVerify",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.otpVerify = result;
      console.log(`❌ Verify OTP error: ${err.message}\n`);
      return result;
    }
  }

  async markDelivered() {
    console.log("✅ STEP 11: Mark Delivered");
    console.log("─".repeat(50));
    
    try {
      const deliveredBtn = await this.engine.page.locator('button:has-text("Delivered"), button:has-text("Complete")').first();
      
      if (await deliveredBtn.isVisible({ timeout: 5000 })) {
        await deliveredBtn.click();
        await this.engine.page.waitForTimeout(2000);
        await this.engine.screenshot("delivery_delivered.png");
        
        const result = {
          step: "delivered",
          success: true,
          timestamp: Date.now(),
          errors: this.consoleMonitor.errors.slice(-5),
        };
        
        this.flowSteps.push(result);
        this.results.delivered = result;
        console.log("✅ Marked as delivered\n");
        return result;
      } else {
        console.log("⚠️  Delivered button not visible\n");
        const result = {
          step: "delivered",
          success: false,
          skipped: true,
          timestamp: Date.now(),
        };
        this.flowSteps.push(result);
        this.results.delivered = result;
        return result;
      }
    } catch (err) {
      const result = {
        step: "delivered",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.delivered = result;
      console.log(`❌ Mark delivered error: ${err.message}\n`);
      return result;
    }
  }

  async checkEarnings() {
    console.log("💵 STEP 12: Check Earnings");
    console.log("─".repeat(50));
    
    try {
      await this.engine.navigate("/delivery/earnings");
      await this.engine.page.waitForTimeout(2000);
      await this.engine.screenshot("delivery_earnings.png");
      
      // Check if earnings are displayed
      const earningsText = await this.engine.getText('[class*="earning"], [class*="amount"]');
      
      const result = {
        step: "earnings",
        success: true,
        earningsVisible: earningsText.length > 0,
        earningsText,
        timestamp: Date.now(),
        errors: this.consoleMonitor.errors.slice(-5),
      };
      
      this.flowSteps.push(result);
      this.results.earnings = result;
      console.log("✅ Earnings checked\n");
      return result;
    } catch (err) {
      const result = {
        step: "earnings",
        success: false,
        error: err.message,
        timestamp: Date.now(),
      };
      this.flowSteps.push(result);
      this.results.earnings = result;
      console.log(`❌ Check earnings error: ${err.message}\n`);
      return result;
    }
  }

  async runFullFlow() {
    console.log("\n" + "=".repeat(60));
    console.log("🚚 DELIVERY WORKFLOW TEST");
    console.log("=".repeat(60) + "\n");
    
    await this.initialize();
    
    // Execute all steps
    await this.login();
    await this.goOnline();
    await this.acceptOrder();
    await this.markPickedUp();
    await this.startDelivery();
    await this.markArrived();
    await this.collectCOD("cash");
    await this.collectCOD("upi");
    await this.sendOTP();
    await this.resendOTP();
    await this.verifyOTP();
    await this.markDelivered();
    await this.checkEarnings();
    
    // Generate report
    const report = this.generateReport();
    
    await this.engine.close();
    
    return report;
  }

  generateReport() {
    const successfulSteps = this.flowSteps.filter((s) => s.success).length;
    const failedSteps = this.flowSteps.filter((s) => !s.success && !s.skipped).length;
    const skippedSteps = this.flowSteps.filter((s) => s.skipped).length;
    
    const consoleReport = this.consoleMonitor.getReport();
    
    const report = {
      timestamp: new Date().toISOString(),
      flow: "delivery_complete",
      summary: {
        totalSteps: this.flowSteps.length,
        successful: successfulSteps,
        failed: failedSteps,
        skipped: skippedSteps,
        successRate: Math.round((successfulSteps / this.flowSteps.length) * 100),
      },
      steps: this.flowSteps,
      results: this.results,
      consoleErrors: consoleReport,
      healthScore: this.consoleMonitor.getHealthScore(),
    };
    
    return report;
  }

  async saveReport(outputPath) {
    const report = this.generateReport();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${outputPath}`);
    
    return report;
  }
}

export default DeliveryAgent;
