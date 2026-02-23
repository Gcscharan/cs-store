import fs from "fs";
import path from "path";

const ALLOWED_FILE = path.normalize(
  "src/domains/orders/services/inventoryReservationService.ts"
);

const COMMIT_ANCHOR = "commitReservationsForOrder";
const NEXT_FN_ANCHOR = "releaseActiveReservationsForOrder";

// Detect any $inc object that decrements reservedStock (strict text scan; matches comments/strings too).
// IMPORTANT: constrain to the same object literal (`{ ... }`) so we don't accidentally
// start matching at one `$inc: { ... }` and finish at a later reservedStock decrement.
const MATCH = /\$inc\s*:\s*\{[^}]*\breservedStock\s*:\s*-/g;

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
      if (name === "node_modules" || name === "dist" || name === "coverage" || name === ".git") continue;

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

function indexToLine(content: string, idx: number): number {
  // 1-based line number
  let line = 1;
  for (let i = 0; i < idx && i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function computeAllowedCommitRange(content: string): { start: number; end: number } | null {
  const start = content.indexOf(COMMIT_ANCHOR);
  if (start < 0) return null;

  const next = content.indexOf(NEXT_FN_ANCHOR, start + COMMIT_ANCHOR.length);
  return { start, end: next >= 0 ? next : content.length };
}

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");
  if (!isDirectory(backendRoot)) {
    console.error(`[ci][check-reservedstock-underflow] Backend root not found: ${backendRoot}`);
    process.exit(1);
  }

  const files = walkTsFiles(backendRoot);

  const violations: Array<{ file: string; line: number }> = [];

  for (const abs of files) {
    const rel = path.normalize(path.relative(backendRoot, abs));

    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    let allowedRange: { start: number; end: number } | null = null;
    if (rel === ALLOWED_FILE) {
      allowedRange = computeAllowedCommitRange(content);
    }

    MATCH.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MATCH.exec(content))) {
      const idx = m.index;

      // Allow exactly the commitReservationsForOrder() region in the allowed file.
      if (rel === ALLOWED_FILE && allowedRange && idx >= allowedRange.start && idx < allowedRange.end) {
        continue;
      }

      violations.push({ file: rel, line: indexToLine(content, idx) });
    }

    MATCH.lastIndex = 0;
  }

  if (violations.length > 0) {
    console.error("\n[CI INVARIANT FAILED] Illegal reservedStock decrement detected");
    console.error(
      "Found `$inc` operations that decrement `reservedStock`. This is forbidden because it can underflow under retries/concurrency.\n" +
        "Only one exception is allowed: inventoryReservationService.commitReservationsForOrder() (guarded commit).\n" +
        `Allowed file: ${ALLOWED_FILE} (only within ${COMMIT_ANCHOR}())\n`
    );

    const sorted = violations
      .slice()
      .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

    for (const v of sorted) {
      console.error(`- ${v.file}:${v.line}`);
    }

    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-reservedstock-underflow] OK\n");
}

main();
