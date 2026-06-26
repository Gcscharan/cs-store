#!/usr/bin/env node
/**
 * Flow Coverage Engine
 * Tracks coverage of AUTH, CUSTOMER, ADMIN, DELIVERY, PAYMENT, SOCKET flows
 */

export class FlowCoverage {
  constructor() {
    this.coveredFlows = new Map();
    this.flowDefinitions = {
      auth: {
        login: false,
        logout: false,
        signup: false,
        passwordReset: false,
        tokenRefresh: false,
        sessionExpiry: false,
      },
      customer: {
        browse: false,
        search: false,
        addToCart: false,
        checkout: false,
        payment: false,
        orderPlacement: false,
        orderTracking: false,
        orderCancellation: false,
        profileUpdate: false,
        addressManagement: false,
      },
      admin: {
        dashboard: false,
        productManagement: false,
        orderManagement: false,
        userManagement: false,
        routeGeneration: false,
        riderAssignment: false,
        analytics: false,
        finance: false,
      },
      delivery: {
        login: false,
        goOnline: false,
        acceptOrder: false,
        pickup: false,
        startDelivery: false,
        markArrived: false,
        codCash: false,
        codUpi: false,
        otpSend: false,
        otpResend: false,
        otpVerify: false,
        markDelivered: false,
        earningsCheck: false,
        goOffline: false,
      },
      payment: {
        codCollection: false,
        upiPayment: false,
        cardPayment: false,
        walletPayment: false,
        refund: false,
        paymentCallback: false,
      },
      socket: {
        connect: false,
        disconnect: false,
        reconnect: false,
        roomJoin: false,
        roomLeave: false,
        eventReceive: false,
        eventEmit: false,
      },
      offline: {
        goOffline: false,
        actionWhileOffline: false,
        queueAction: false,
        reconnect: false,
        replayQueued: false,
        stateRecovery: false,
      },
      reconnect: {
        disconnect: false,
        waitForReconnect: false,
        autoReconnect: false,
        refetchData: false,
        cacheRepair: false,
        staleStateCleanup: false,
      },
      otp: {
        send: false,
        resend: false,
        verify: false,
        expire: false,
        rateLimit: false,
      },
      cod: {
        collectCash: false,
        collectUpi: false,
        recordTransaction: false,
        updateOrderStatus: false,
      },
      earnings: {
        credit: false,
        display: false,
        withdraw: false,
        history: false,
      },
    };
  }

  markFlowCovered(category, flowName) {
    if (!this.coveredFlows.has(category)) {
      this.coveredFlows.set(category, new Set());
    }
    this.coveredFlows.get(category).add(flowName);

    if (this.flowDefinitions[category] && this.flowDefinitions[category][flowName] !== undefined) {
      this.flowDefinitions[category][flowName] = true;
    }
  }

  markFlowsCovered(category, flowNames) {
    for (const flowName of flowNames) {
      this.markFlowCovered(category, flowName);
    }
  }

  isFlowCovered(category, flowName) {
    return this.coveredFlows.has(category) && this.coveredFlows.get(category).has(flowName);
  }

  getCategoryCoverage(category) {
    const flows = this.flowDefinitions[category];
    if (!flows) return { covered: 0, total: 0, percentage: 0 };

    const total = Object.keys(flows).length;
    const covered = Object.values(flows).filter((v) => v === true).length;
    const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;

    return { covered, total, percentage };
  }

  getOverallCoverage() {
    const categories = {};
    let totalFlows = 0;
    let totalCovered = 0;

    for (const [category, flows] of Object.entries(this.flowDefinitions)) {
      const coverage = this.getCategoryCoverage(category);
      categories[category] = coverage;
      totalFlows += coverage.total;
      totalCovered += coverage.covered;
    }

    const overallPercentage = totalFlows > 0 ? Math.round((totalCovered / totalFlows) * 100) : 0;

    return {
      overall: {
        covered: totalCovered,
        total: totalFlows,
        percentage: overallPercentage,
      },
      categories,
    };
  }

  getUncoveredFlows(category) {
    const flows = this.flowDefinitions[category];
    if (!flows) return [];

    return Object.entries(flows)
      .filter(([name, covered]) => !covered)
      .map(([name]) => name);
  }

  getAllUncoveredFlows() {
    const uncovered = {};

    for (const [category, flows] of Object.entries(this.flowDefinitions)) {
      const uncoveredInCategory = this.getUncoveredFlows(category);
      if (uncoveredInCategory.length > 0) {
        uncovered[category] = uncoveredInCategory;
      }
    }

    return uncovered;
  }

  getCoverageReport() {
    const coverage = this.getOverallCoverage();
    const uncovered = this.getAllUncoveredFlows();

    return {
      timestamp: new Date().toISOString(),
      overall: coverage.overall,
      categories: coverage.categories,
      uncoveredFlows: uncovered,
      recommendations: this.generateRecommendations(coverage, uncovered),
    };
  }

  generateRecommendations(coverage, uncovered) {
    const recommendations = [];

    // Check critical categories
    if (coverage.categories.delivery?.percentage < 80) {
      recommendations.push("🚨 Critical: Delivery flow coverage below 80%");
    }

    if (coverage.categories.payment?.percentage < 80) {
      recommendations.push("💰 Critical: Payment flow coverage below 80%");
    }

    if (coverage.categories.auth?.percentage < 80) {
      recommendations.push("🔐 Critical: Authentication flow coverage below 80%");
    }

    if (coverage.categories.socket?.percentage < 80) {
      recommendations.push("🔌 Important: Socket flow coverage below 80%");
    }

    if (coverage.categories.offline?.percentage < 80) {
      recommendations.push("📶 Important: Offline flow coverage below 80%");
    }

    // Specific flow recommendations
    if (uncovered.delivery?.includes("otpVerify")) {
      recommendations.push("⚠️  OTP verification not tested - critical for delivery");
    }

    if (uncovered.delivery?.includes("codCash")) {
      recommendations.push("⚠️  COD cash collection not tested - critical for payments");
    }

    if (uncovered.payment?.includes("refund")) {
      recommendations.push("⚠️  Refund flow not tested - important for customer support");
    }

    if (uncovered.offline?.includes("replayQueued")) {
      recommendations.push("⚠️  Offline replay not tested - critical for reliability");
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ All critical flows have adequate coverage");
    }

    return recommendations;
  }

  reset() {
    this.coveredFlows.clear();
    for (const category in this.flowDefinitions) {
      for (const flow in this.flowDefinitions[category]) {
        this.flowDefinitions[category][flow] = false;
      }
    }
  }

  saveReport(outputPath) {
    const report = this.getCoverageReport();
    const fs = require("fs");
    const path = require("path");

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📊 Coverage report saved: ${outputPath}`);

    return report;
  }

  loadReport(inputPath) {
    const fs = require("fs");
    const path = require("path");

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Coverage report not found: ${inputPath}`);
      return null;
    }

    const data = fs.readFileSync(inputPath, "utf-8");
    const report = JSON.parse(data);

    // Restore coverage state
    for (const [category, flows] of Object.entries(this.flowDefinitions)) {
      if (report.categories[category]) {
        for (const flowName of Object.keys(flows)) {
          if (report.categories[category].coveredFlows?.includes(flowName)) {
            this.markFlowCovered(category, flowName);
          }
        }
      }
    }

    console.log(`✅ Coverage report loaded: ${inputPath}`);
    return report;
  }
}

export default FlowCoverage;
