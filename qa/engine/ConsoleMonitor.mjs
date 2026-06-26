#!/usr/bin/env node
/**
 * Console Error Monitor
 * Detects crashes, red screens, API failures, and runtime errors
 */

export class ConsoleMonitor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.crashes = [];
    this.apiFailures = [];
    this.unhandledRejections = [];
    this.metrics = {
      totalErrors: 0,
      totalWarnings: 0,
      totalCrashes: 0,
      totalAPIFailures: 0,
      totalUnhandledRejections: 0,
    };
  }

  setupMonitoring(page) {
    // Console errors
    page.on("console", (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now(),
      };

      if (msg.type() === "error") {
        this.errors.push(entry);
        this.metrics.totalErrors++;
        console.log(`🔴 Console Error: ${msg.text()}`);
      } else if (msg.type() === "warning") {
        this.warnings.push(entry);
        this.metrics.totalWarnings++;
      }
    });

    // Page errors (crashes)
    page.on("pageerror", (err) => {
      const crash = {
        message: err.message,
        stack: err.stack,
        name: err.name,
        timestamp: Date.now(),
      };
      this.crashes.push(crash);
      this.metrics.totalCrashes++;
      console.log(`💥 Page Crash: ${err.message}`);
    });

    // Response errors (API failures)
    page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) {
        const failure = {
          url: res.url(),
          status: status,
          method: res.request()?.method() || "GET",
          timestamp: Date.now(),
        };
        this.apiFailures.push(failure);
        this.metrics.totalAPIFailures++;
        console.log(`⚠️  API Failure: ${status} ${res.url()}`);
      }
    });

    // Unhandled promise rejections
    page.on("console", (msg) => {
      if (msg.text().includes("Unhandled promise rejection")) {
        const rejection = {
          text: msg.text(),
          location: msg.location(),
          timestamp: Date.now(),
        };
        this.unhandledRejections.push(rejection);
        this.metrics.totalUnhandledRejections++;
        console.log(`⚠️  Unhandled Rejection: ${msg.text()}`);
      }
    });
  }

  detectRedScreen(page) {
    // Check for red screen of death (React error overlay)
    return page.evaluate(() => {
      const errorOverlay = document.querySelector('[data-reactroot]')?.textContent || "";
      const hasErrorOverlay = errorOverlay.includes("Error") || errorOverlay.includes("crash");
      const hasRedBackground = document.body.style.backgroundColor === "red";
      
      return {
        hasErrorOverlay,
        hasRedBackground,
        errorText: errorOverlay.substring(0, 200),
      };
    });
  }

  detectInfiniteLoops(page) {
    // Check for signs of infinite loops (console spam, frozen UI)
    return new Promise((resolve) => {
      const startTime = Date.now();
      let errorCount = 0;
      
      const checkInterval = setInterval(() => {
        errorCount = this.errors.filter((e) => e.timestamp > startTime).length;
        
        if (errorCount > 50) {
          clearInterval(checkInterval);
          resolve({
            detected: true,
            errorCount,
            reason: "Too many errors in short time",
          });
          return;
        }
        
        if (Date.now() - startTime > 5000) {
          clearInterval(checkInterval);
          resolve({ detected: false, errorCount });
        }
      }, 1000);
    });
  }

  detectRetryStorms() {
    // Detect API retry storms (same request failing repeatedly)
    const urlCounts = {};
    
    for (const failure of this.apiFailures) {
      const key = `${failure.method} ${failure.url}`;
      urlCounts[key] = (urlCounts[key] || 0) + 1;
    }
    
    const storms = [];
    for (const [key, count] of Object.entries(urlCounts)) {
      if (count >= 5) {
        storms.push({
          request: key,
          failureCount: count,
          severity: count >= 10 ? "critical" : "high",
        });
      }
    }
    
    return storms;
  }

  detectMemoryLeaks(page) {
    // Check for memory leak indicators
    return page.evaluate(() => {
      const performance = window.performance || {};
      const memory = performance.memory;
      
      if (memory) {
        const usedJSHeapSize = memory.usedJSHeapSize;
        const totalJSHeapSize = memory.totalJSHeapSize;
        const jsHeapSizeLimit = memory.jsHeapSizeLimit;
        
        const usagePercent = (usedJSHeapSize / jsHeapSizeLimit) * 100;
        
        return {
          usedMB: Math.round(usedJSHeapSize / 1024 / 1024),
          totalMB: Math.round(totalJSHeapSize / 1024 / 1024),
          limitMB: Math.round(jsHeapSizeLimit / 1024 / 1024),
          usagePercent: Math.round(usagePercent),
          highUsage: usagePercent > 80,
        };
      }
      
      return { available: false };
    });
  }

  categorizeError(error) {
    const text = error.text.toLowerCase();
    
    if (text.includes("network") || text.includes("fetch")) {
      return "network";
    }
    if (text.includes("timeout")) {
      return "timeout";
    }
    if (text.includes("permission") || text.includes("auth")) {
      return "auth";
    }
    if (text.includes("undefined") || text.includes("null")) {
      return "null_reference";
    }
    if (text.includes("react") || text.includes("component")) {
      return "react";
    }
    if (text.includes("type") || text.includes("cannot read")) {
      return "type_error";
    }
    
    return "unknown";
  }

  getSeverity(error) {
    const category = this.categorizeError(error);
    
    const severityMap = {
      network: "medium",
      timeout: "medium",
      auth: "high",
      null_reference: "high",
      react: "critical",
      type_error: "high",
      unknown: "low",
    };
    
    return severityMap[category] || "low";
  }

  getReport() {
    const retryStorms = this.detectRetryStorms();
    
    return {
      summary: {
        totalErrors: this.metrics.totalErrors,
        totalWarnings: this.metrics.totalWarnings,
        totalCrashes: this.metrics.totalCrashes,
        totalAPIFailures: this.metrics.totalAPIFailures,
        totalUnhandledRejections: this.metrics.totalUnhandledRejections,
        retryStorms: retryStorms.length,
      },
      errors: this.errors.slice(-20), // Last 20 errors
      crashes: this.crashes,
      apiFailures: this.apiFailures.slice(-20),
      unhandledRejections: this.unhandledRejections,
      retryStorms,
      criticalIssues: [
        ...this.crashes.map((c) => ({ type: "crash", message: c.message })),
        ...retryStorms.map((s) => ({ type: "retry_storm", request: s.request })),
      ],
    };
  }

  reset() {
    this.errors = [];
    this.warnings = [];
    this.crashes = [];
    this.apiFailures = [];
    this.unhandledRejections = [];
    this.metrics = {
      totalErrors: 0,
      totalWarnings: 0,
      totalCrashes: 0,
      totalAPIFailures: 0,
      totalUnhandledRejections: 0,
    };
  }

  hasCriticalErrors() {
    return this.crashes.length > 0 || this.detectRetryStorms().length > 0;
  }

  getHealthScore() {
    let score = 100;
    
    // Deduct for crashes
    score -= this.crashes.length * 20;
    
    // Deduct for API failures
    score -= this.apiFailures.length * 2;
    
    // Deduct for console errors
    score -= this.errors.length * 1;
    
    // Deduct for retry storms
    score -= this.detectRetryStorms().length * 10;
    
    // Deduct for unhandled rejections
    score -= this.unhandledRejections.length * 5;
    
    return Math.max(0, score);
  }
}

export default ConsoleMonitor;
