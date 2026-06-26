#!/usr/bin/env node
/**
 * Network Validation Layer
 * Captures all requests, validates responses, detects retry storms
 */

export class NetworkMonitor {
  constructor() {
    this.requests = [];
    this.responses = [];
    this.failures = [];
    this.duplicates = new Map();
    this.retryPatterns = new Map();
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      duplicateCount: 0,
      retryStormCount: 0,
      avgResponseTime: 0,
    };
  }

  setupMonitoring(page) {
    // Track all requests
    page.on("request", (req) => {
      const request = {
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        headers: req.headers(),
        timestamp: Date.now(),
      };
      this.requests.push(request);
      this.metrics.totalRequests++;

      // Check for duplicates
      this.checkDuplicate(request);
    });

    // Track all responses
    page.on("response", (res) => {
      const response = {
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        headers: res.headers(),
        timing: typeof res.timing === "function" ? res.timing() : null,
        timestamp: Date.now(),
      };
      this.responses.push(response);

      // Check for retry patterns
      this.checkRetryPattern(response);
    });

    // Track failures
    page.on("requestfailed", (req) => {
      const failure = {
        url: req.url(),
        method: req.method(),
        error: req.failure()?.errorText || "Unknown error",
        failureType: req.failure()?.errorText || "Unknown",
        timestamp: Date.now(),
      };
      this.failures.push(failure);
      this.metrics.totalFailures++;

      console.log(`⚠️  Network Failure: ${req.method()} ${req.url()} - ${failure.error}`);
    });
  }

  checkDuplicate(request) {
    const key = `${request.method} ${request.url}`;
    const now = Date.now();
    const recent = this.duplicates.get(key);

    if (recent && (now - recent) < 100) {
      // Duplicate within 100ms
      this.metrics.duplicateCount++;
      console.log(`🔄 Duplicate request: ${key}`);
    }

    this.duplicates.set(key, now);
  }

  checkRetryPattern(response) {
    if (response.status >= 400) {
      const key = `${response.url}`;
      const attempts = this.retryPatterns.get(key) || [];
      attempts.push({
        status: response.status,
        timestamp: response.timestamp,
      });
      this.retryPatterns.set(key, attempts);

      // Check for retry storm (5+ failures within 10 seconds)
      if (attempts.length >= 5) {
        const first = attempts[0];
        const last = attempts[attempts.length - 1];
        if (last.timestamp - first.timestamp < 10000) {
          this.metrics.retryStormCount++;
          console.log(`🌊 Retry storm detected: ${key} (${attempts.length} attempts)`);
        }
      }
    }
  }

  detectRetryStorms() {
    const storms = [];

    for (const [url, attempts] of this.retryPatterns.entries()) {
      if (attempts.length >= 5) {
        const first = attempts[0];
        const last = attempts[attempts.length - 1];
        const duration = last.timestamp - first.timestamp;

        if (duration < 10000) {
          storms.push({
            url,
            attempts: attempts.length,
            duration,
            severity: attempts.length >= 10 ? "critical" : "high",
            statuses: attempts.map((a) => a.status),
          });
        }
      }
    }

    return storms;
  }

  detectMissingRequests(expectedRequests) {
    const actualUrls = new Set(this.requests.map((r) => r.url));
    const missing = [];

    for (const expected of expectedRequests) {
      if (!actualUrls.has(expected.url)) {
        missing.push({
          url: expected.url,
          method: expected.method || "GET",
          reason: "Request not sent",
        });
      }
    }

    return missing;
  }

  getAverageResponseTime() {
    if (this.responses.length === 0) return 0;

    const totalTime = this.responses.reduce((sum, res) => {
      return sum + (res.timing?.responseEnd || 0);
    }, 0);

    return Math.round(totalTime / this.responses.length);
  }

  getSlowRequests(threshold = 3000) {
    return this.responses.filter((res) => {
      const duration = res.timing?.responseEnd || 0;
      return duration > threshold;
    });
  }

  getFailedRequests() {
    return this.responses.filter((res) => res.status >= 400);
  }

  getAPIRequests() {
    return this.requests.filter((req) => {
      return req.resourceType === "fetch" || req.resourceType === "xhr";
    });
  }

  validateAPIResponse(url, expectedStatus = 200) {
    const responses = this.responses.filter((r) => r.url === url);
    
    if (responses.length === 0) {
      return {
        valid: false,
        reason: "No response received",
      };
    }

    const lastResponse = responses[responses.length - 1];
    
    return {
      valid: lastResponse.status === expectedStatus,
      status: lastResponse.status,
      expected: expectedStatus,
    };
  }

  getRequestCount(url) {
    return this.requests.filter((r) => r.url === url).length;
  }

  getReport() {
    const retryStorms = this.detectRetryStorms();
    const slowRequests = this.getSlowRequests();
    const failedRequests = this.getFailedRequests();
    const avgResponseTime = this.getAverageResponseTime();

    return {
      summary: {
        totalRequests: this.metrics.totalRequests,
        totalFailures: this.metrics.totalFailures,
        duplicateCount: this.metrics.duplicateCount,
        retryStormCount: this.metrics.retryStormCount,
        avgResponseTime,
      },
      retryStorms,
      slowRequests: slowRequests.slice(0, 10),
      failedRequests: failedRequests.slice(0, 10),
      failures: this.failures.slice(0, 20),
      criticalIssues: [
        ...retryStorms.map((s) => ({ type: "retry_storm", url: s.url, severity: s.severity })),
        ...failedRequests.filter((f) => f.status >= 500).map((f) => ({
          type: "server_error",
          url: f.url,
          status: f.status,
        })),
      ],
    };
  }

  reset() {
    this.requests = [];
    this.responses = [];
    this.failures = [];
    this.duplicates.clear();
    this.retryPatterns.clear();
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      duplicateCount: 0,
      retryStormCount: 0,
      avgResponseTime: 0,
    };
  }

  hasCriticalIssues() {
    return this.metrics.retryStormCount > 0 || this.metrics.totalFailures > 10;
  }

  getHealthScore() {
    let score = 100;

    // Deduct for failures
    score -= this.metrics.totalFailures * 2;

    // Deduct for retry storms
    score -= this.metrics.retryStormCount * 15;

    // Deduct for duplicates
    score -= this.metrics.duplicateCount * 1;

    // Deduct for slow responses
    const slowCount = this.getSlowRequests().length;
    score -= slowCount * 1;

    return Math.max(0, score);
  }
}

export default NetworkMonitor;
