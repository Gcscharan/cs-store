import fs from "fs";
import path from "path";

type Failure = {
  file: string;
  rule: string;
  details: string;
};

function readText(absPath: string): string {
  return fs.readFileSync(absPath, "utf8");
}

function existsFile(absPath: string): boolean {
  try {
    return fs.statSync(absPath).isFile();
  } catch {
    return false;
  }
}

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");

  const appPath = path.join(backendRoot, "src/app.ts");
  const webhookProcessorPath = path.join(
    backendRoot,
    "src/domains/payments/services/webhookProcessor.ts"
  );

  const failures: Failure[] = [];

  if (!existsFile(appPath)) {
    failures.push({
      file: "src/app.ts",
      rule: "express.raw({ type: \"application/json\" }) is used for /api/webhooks/razorpay",
      details: "File not found",
    });
  } else {
    const app = readText(appPath);

    const rawWebhookMiddlewareRe =
      /app\.use\(\s*["'`]\/api\/webhooks\/razorpay["'`]\s*,[\s\S]{0,400}?express\.raw\(\s*\{\s*type\s*:\s*["'`]application\/json["'`]\s*\}\s*\)\s*\)/;

    if (!rawWebhookMiddlewareRe.test(app)) {
      failures.push({
        file: "src/app.ts",
        rule: "express.raw({ type: \"application/json\" }) is used for /api/webhooks/razorpay",
        details:
          "Expected an app.use(\"/api/webhooks/razorpay\", express.raw({ type: \"application/json\" })) middleware before JSON body parsers.",
      });
    }
  }

  if (!existsFile(webhookProcessorPath)) {
    failures.push({
      file: "src/domains/payments/services/webhookProcessor.ts",
      rule: "verifyWebhookSignature() is called",
      details: "File not found",
    });
    failures.push({
      file: "src/domains/payments/services/webhookProcessor.ts",
      rule: "WebhookEventInbox is referenced",
      details: "File not found",
    });
  } else {
    const proc = readText(webhookProcessorPath);

    const verifyWebhookSignatureRe = /\bverifyWebhookSignature\s*\(/;
    if (!verifyWebhookSignatureRe.test(proc)) {
      failures.push({
        file: "src/domains/payments/services/webhookProcessor.ts",
        rule: "verifyWebhookSignature() is called",
        details:
          "Expected webhook processor to call adapter.verifyWebhookSignature({ rawBody, headers }) before parsing/processing.",
      });
    }

    const webhookInboxRe = /\bWebhookEventInbox\b/;
    if (!webhookInboxRe.test(proc)) {
      failures.push({
        file: "src/domains/payments/services/webhookProcessor.ts",
        rule: "WebhookEventInbox is referenced",
        details:
          "Expected webhook processor to reference WebhookEventInbox for inbox idempotency/deduplication.",
      });
    }
  }

  if (failures.length > 0) {
    console.error("\n[CI INVARIANT FAILED] Razorpay webhook safety invariants missing\n");
    for (const f of failures) {
      console.error(`--- ${f.file} ---`);
      console.error(`Missing: ${f.rule}`);
      console.error(`${f.details}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("[ci][check-webhook-safety] OK\n");
}

main();
