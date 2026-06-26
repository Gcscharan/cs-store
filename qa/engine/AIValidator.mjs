#!/usr/bin/env node
/**
 * AI Validation Layer
 * Uses Ollama to analyze screens, detect bugs, and validate behavior
 */

import http from "http";

export class AIValidator {
  constructor(options = {}) {
    const opts = options || {};
    this.ollamaHost = opts.ollamaHost || "http://localhost:11434";
    this.model = opts.model || "llama3.2";
    this.enabled = false;
  }

  async checkAvailability() {
    return new Promise((resolve) => {
      const req = http.get(`${this.ollamaHost}/api/tags`, { timeout: 3000 }, (res) => {
        this.enabled = res.statusCode === 200;
        resolve(this.enabled);
      });
      req.on("error", () => {
        this.enabled = false;
        resolve(false);
      });
      req.on("timeout", () => {
        req.destroy();
        this.enabled = false;
        resolve(false);
      });
    });
  }

  async analyzeScreen(screenData) {
    if (!this.enabled) {
      return {
        status: "skipped",
        reason: "Ollama not available",
      };
    }

    const prompt = this.buildScreenAnalysisPrompt(screenData);
    return await this.queryOllama(prompt);
  }

  buildScreenAnalysisPrompt(screenData) {
    return `You are an expert QA engineer analyzing a web application screen.

SCREEN: ${screenData.name}
URL: ${screenData.url}

VISIBLE ELEMENTS:
Buttons: ${screenData.buttons?.map((b) => b.text).join(", ") || "none"}
Links: ${screenData.links?.map((l) => l.text).join(", ") || "none"}
Headings: ${screenData.headings?.map((h) => `${h.tag}: ${h.text}`).join(", ") || "none"}

CONSOLE ERRORS:
${screenData.consoleErrors?.map((e) => `- ${e.text}`).join("\n") || "none"}

PAGE ERRORS:
${screenData.pageErrors?.map((e) => `- ${e.message}`).join("\n") || "none"}

ANALYSIS TASK:
1. Is this screen functioning correctly? (yes/no)
2. Are there any obvious UI bugs?
3. Are there any critical errors?
4. Is the content appropriate for this screen?
5. What is the overall health score (0-100)?

Respond in JSON format:
{
  "status": "success|partial|failure",
  "healthScore": 0-100,
  "issues": ["list of issues found"],
  "observations": ["list of observations"],
  "recommendation": "brief recommendation"
}`;
  }

  async analyzeAction(action, beforeState, afterState) {
    if (!this.enabled) {
      return { status: "skipped", reason: "Ollama not available" };
    }

    const prompt = `You are a QA engineer analyzing a user action.

ACTION: ${action.type} on ${action.element}
TEXT: ${action.text || "N/A"}
SELECTOR: ${action.selector}

BEFORE STATE:
URL: ${beforeState.url}
Console Errors: ${beforeState.consoleErrors?.length || 0}

AFTER STATE:
URL: ${afterState.url}
Console Errors: ${afterState.consoleErrors?.length || 0}
New Errors: ${afterState.consoleErrors?.slice(beforeState.consoleErrors?.length || 0).map((e) => e.text).join(", ") || "none"}

ANALYSIS:
Did this action work correctly? Did it cause any errors? Did it navigate as expected?

Respond in JSON:
{
  "status": "success|partial|failure",
  "navigationOccurred": boolean,
  "errorsIntroduced": number,
  "observations": ["list"],
  "recommendation": "string"
}`;

    return await this.queryOllama(prompt);
  }

  async analyzeFlow(flowSteps) {
    if (!this.enabled) {
      return { status: "skipped", reason: "Ollama not available" };
    }

    const flowDescription = flowSteps
      .map((step, i) => `${i + 1}. ${step.action} on "${step.element || step.selector}"`)
      .join("\n");

    const prompt = `You are a QA engineer analyzing a user flow.

FLOW:
${flowDescription}

STEPS COMPLETED: ${flowSteps.filter((s) => s.success).length}
STEPS FAILED: ${flowSteps.filter((s) => !s.success).length}

TOTAL ERRORS: ${flowSteps.reduce((sum, s) => sum + (s.errors?.length || 0), 0)}

ANALYSIS:
Is this flow working correctly? Are there any broken steps? What is the overall flow health?

Respond in JSON:
{
  "status": "success|partial|failure",
  "healthScore": 0-100,
  "brokenSteps": ["step descriptions"],
  "observations": ["list"],
  "recommendation": "string"
}`;

    return await this.queryOllama(prompt);
  }

  async detectBugs(screenData) {
    if (!this.enabled) {
      return { status: "skipped", reason: "Ollama not available" };
    }

    const prompt = `You are a bug detection specialist analyzing a web screen.

SCREEN: ${screenData.name}

CONSOLE ERRORS:
${screenData.consoleErrors?.map((e) => e.text).join("\n") || "none"}

PAGE ERRORS:
${screenData.pageErrors?.map((e) => e.message).join("\n") || "none"}

NETWORK FAILURES:
${screenData.networkFailures?.map((f) => f.url + ": " + f.error).join("\n") || "none"}

TASK:
Identify any bugs, crashes, or broken functionality. Categorize by severity (critical, high, medium, low).

Respond in JSON:
{
  "bugs": [
    {
      "severity": "critical|high|medium|low",
      "type": "crash|network|ui|logic|performance",
      "description": "description",
      "evidence": "error message or observation"
    }
  ],
  "overallHealth": "critical|unstable|stable|excellent"
}`;

    return await this.queryOllama(prompt);
  }

  async queryOllama(prompt) {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
      });

      const req = http.request(
        `${this.ollamaHost}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
          timeout: 30000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const response = JSON.parse(data);
              // Try to extract JSON from the response
              const jsonMatch = response.response?.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                resolve(JSON.parse(jsonMatch[0]));
              } else {
                resolve({
                  status: "unknown",
                  observations: [response.response?.substring(0, 200) || "No response"],
                });
              }
            } catch {
              resolve({
                status: "error",
                error: "Failed to parse AI response",
              });
            }
          });
        }
      );

      req.on("error", () => {
        resolve({ status: "error", error: "Ollama request failed" });
      });
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: "error", error: "Ollama timeout" });
      });

      req.write(postData);
      req.end();
    });
  }

  async validateExpectedBehavior(expected, actual) {
    if (!this.enabled) {
      return { status: "skipped", reason: "Ollama not available" };
    }

    const prompt = `You are a QA engineer validating expected vs actual behavior.

EXPECTED:
${JSON.stringify(expected, null, 2)}

ACTUAL:
${JSON.stringify(actual, null, 2)}

TASK:
Compare expected vs actual. Are they equivalent? If not, what's different?

Respond in JSON:
{
  "match": true|false,
  "differences": ["list of differences"],
  "severity": "critical|high|medium|low",
  "recommendation": "string"
}`;

    return await this.queryOllama(prompt);
  }
}

export default AIValidator;
