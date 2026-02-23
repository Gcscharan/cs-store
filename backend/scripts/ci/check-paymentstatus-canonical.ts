import fs from "fs";
import path from "path";

const MATCHES: RegExp[] = [
  /\bpaymentStatus\s*:\s*["']paid["']/g,
  /\bpaymentStatus\s*=\s*["']paid["']/g,
];

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
        name === "tests"
      ) {
        continue;
      }

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
    console.error(`[ci][check-paymentstatus-canonical] Backend root not found: ${backendRoot}`);
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

    let hit = false;
    for (const re of MATCHES) {
      if (re.test(content)) {
        hit = true;
      }
      re.lastIndex = 0;
    }

    if (hit) {
      offenders.add(rel);
    }
  }

  if (offenders.size > 0) {
    console.error("\n[CI INVARIANT FAILED] Non-canonical paymentStatus literal detected\n");
    console.error(
      "Found runtime code using `paymentStatus: \"paid\"` or `paymentStatus = \"paid\"`.\n" +
        "Canonical paymentStatus vocabulary must be uppercase: PENDING | PAID | FAILED.\n"
    );

    for (const f of Array.from(offenders).sort()) {
      console.error(`- ${f}`);
    }

    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-paymentstatus-canonical] OK\n");
}

main();
