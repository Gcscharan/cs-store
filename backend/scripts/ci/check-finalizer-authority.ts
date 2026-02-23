import fs from "fs";
import path from "path";

const ALLOWED_FILES = new Set(
  [
    "src/domains/payments/services/webhookProcessor.ts",
    "src/domains/payments/services/orderPaymentFinalizer.ts",
  ].map((p) => path.normalize(p))
);

const MATCH = /\bfinalizeOrderOnCapturedPayment\s*\(/g;

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function walkTsFiles(rootDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [rootDir];

  while (stack.length) {
    const dir = stack.pop()!;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (
        name === "node_modules" ||
        name === "dist" ||
        name === "coverage" ||
        name === ".git" ||
        name === "tests" ||
        name === "scripts"
      )
        continue;

      const full = path.join(dir, name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }

      if (ent.isFile() && name.endsWith(".ts")) {
        out.push(full);
      }
    }
  }

  return out;
}

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");
  if (!isDirectory(backendRoot)) {
    console.error(`[ci][check-finalizer-authority] Backend root not found: ${backendRoot}`);
    process.exit(1);
  }

  const files = walkTsFiles(backendRoot);
  const offenders = new Set<string>();

  for (const abs of files) {
    const rel = path.normalize(path.relative(backendRoot, abs));

    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    if (!MATCH.test(content)) continue;

    MATCH.lastIndex = 0;

    if (ALLOWED_FILES.has(rel)) continue;
    offenders.add(rel);
  }

  if (offenders.size > 0) {
    console.error("\n[CI INVARIANT FAILED] finalizeOrderOnCapturedPayment authority violation");
    console.error(
      "Only webhookProcessor may call finalizeOrderOnCapturedPayment (finalizer file may define it).\n" +
        "Any other call site is forbidden.\n" +
        `Allowed files:\n- ${Array.from(ALLOWED_FILES).sort().join("\n- ")}\n`
    );

    const sorted = Array.from(offenders).sort();
    for (const f of sorted) console.error(`- ${f}`);
    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-finalizer-authority] OK\n");
}

main();
