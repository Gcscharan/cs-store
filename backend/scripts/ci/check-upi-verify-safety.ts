import fs from "fs";
import path from "path";

const TARGETS = [
  "src/routes/upi.ts",
  "src/domains/upi/controllers/upiVerificationController.ts",
  "src/domains/upi/services/upiVerificationProvider.ts",
];

const FORBIDDEN = [
  "models/Order",
  "models/Payment",
  "PaymentIntent",
  "payment-intents",
  "inventoryReservation",
  "reserveForOrder",
  "createOrderFromCart",
  "orderPaymentFinalizer",
  "webhooks",
];

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");
  const offenders: string[] = [];

  for (const rel of TARGETS) {
    const abs = path.join(backendRoot, rel);
    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      offenders.push(rel);
      continue;
    }

    for (const tok of FORBIDDEN) {
      if (content.includes(tok)) {
        offenders.push(rel);
        break;
      }
    }
  }

  if (offenders.length) {
    console.error("\n[CI INVARIANT FAILED] UPI verification must be verification-only\n");
    console.error("UPI verify path must not touch Order/PaymentIntent/payment-intents/webhooks/inventory.\n");
    for (const f of Array.from(new Set(offenders)).sort()) console.error(`- ${f}`);
    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-upi-verify-safety] OK\n");
}

main();
