import fs from "fs";
import path from "path";

function walk(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === "coverage" || e.name === ".git") {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (e.isFile() && full.endsWith(".ts")) out.push(full);
    }
  }
  return out;
}

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");
  const srcRoot = path.join(backendRoot, "src");

  const files = walk(srcRoot);
  const offenders: string[] = [];

  const logRe = /console\.(log|error|warn|info)\([\s\S]*?\)/g;
  const vpaTokenRe = /\b(req\.body\?\.vpa|req\.body\.vpa|trimmedVpa|upiVpa)\b/;

  for (const abs of files) {
    const rel = path.relative(backendRoot, abs);
    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    let m: RegExpExecArray | null;
    while ((m = logRe.exec(content))) {
      const snippet = m[0];
      if (vpaTokenRe.test(snippet)) {
        offenders.push(rel);
        break;
      }
    }
    logRe.lastIndex = 0;
  }

  if (offenders.length) {
    console.error("\n[CI INVARIANT FAILED] Potential raw VPA logging detected\n");
    console.error(
      "Backend must never log raw UPI VPA. Use maskUpiVpa(...) and avoid logging vpa/upiVpa/req.body.vpa.\n"
    );
    for (const f of offenders.sort()) console.error(`- ${f}`);
    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-no-raw-vpa-logs] OK\n");
}

main();
