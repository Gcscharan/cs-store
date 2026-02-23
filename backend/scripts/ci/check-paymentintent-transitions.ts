import fs from "fs";
import path from "path";

type Mutation = {
  file: string;
  line: number;
  kind: "assign" | "updateOne" | "findOneAndUpdate";
  snippet: string;
};

const ASSERT_RE = /assertAllowedTransition\s*\(/;

// Direct assignments we care about. (Strict grep: matches in comments/strings too.)
const INTENT_ASSIGN_RE = /\b(?:intent|freshIntent)\b[\s\S]{0,60}\.status\s*=\s*["'`]/;

const UPDATEONE_START_RE = /\bPaymentIntent\.updateOne\s*\(/;
const FINDONEANDUPDATE_START_RE = /\bPaymentIntent\.findOneAndUpdate\s*\(/;

// Only treat as a status mutation if the UPDATE object sets status.
const SETS_STATUS_RE = /\$set\s*:\s*\{[^}]*\bstatus\s*:/;

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
      // CI invariants are enforced for backend runtime code. Tests are allowed to
      // mutate state directly for setup.
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

function extractBlock(lines: string[], startLineIdx: number): { block: string; endLineIdx: number } {
  // Extract from start line until we hit a line containing ");" or we exceed a sane limit.
  const maxLines = 120;
  let end = startLineIdx;
  let block = "";

  for (let i = startLineIdx; i < lines.length && i < startLineIdx + maxLines; i += 1) {
    block += lines[i] + "\n";
    end = i;
    if (lines[i].includes(");")) break;
  }

  return { block, endLineIdx: end };
}

function splitTopLevelArgs(callTextInsideParens: string): string[] {
  const args: string[] = [];
  let cur = "";

  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;

  let inStr: '"' | "'" | "`" | null = null;
  let escape = false;

  for (let i = 0; i < callTextInsideParens.length; i += 1) {
    const ch = callTextInsideParens[i];

    if (inStr) {
      cur += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === inStr) {
        inStr = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch as any;
      cur += ch;
      continue;
    }

    if (ch === "(") depthParen += 1;
    if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    if (ch === "{") depthBrace += 1;
    if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    if (ch === "[") depthBracket += 1;
    if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);

    const atTopLevel = depthParen === 0 && depthBrace === 0 && depthBracket === 0;
    if (ch === "," && atTopLevel) {
      args.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }

  if (cur.trim()) {
    args.push(cur.trim());
  }

  return args;
}

function updateArgHasStatusWrite(callBlock: string): boolean {
  const start = callBlock.indexOf("(");
  const end = callBlock.lastIndexOf(")");
  if (start < 0 || end < 0 || end <= start) return false;

  const inside = callBlock.slice(start + 1, end);
  const args = splitTopLevelArgs(inside);
  if (args.length < 2) return false;

  const updateArg = args[1] || "";
  // Treat any `status:` in the UPDATE argument as a status mutation.
  // This covers both `$set: { status: ... }` and direct `{ status: ... }`.
  return /\bstatus\s*:/.test(updateArg);
}

function getContextSnippet(lines: string[], lineIdx: number): string {
  const start = Math.max(0, lineIdx - 3);
  const end = Math.min(lines.length - 1, lineIdx + 3);
  const out: string[] = [];

  for (let i = start; i <= end; i += 1) {
    const n = String(i + 1).padStart(4, " ");
    const prefix = i === lineIdx ? ">" : " ";
    out.push(`${prefix}${n}| ${lines[i]}`);
  }

  return out.join("\n");
}

function hasAssertionNear(lines: string[], lineIdx: number): boolean {
  // Requirement: assertion appears in the same function OR immediately above.
  // We implement:
  // - immediate-above window (10 lines)
  // - function-scope heuristic: search back to the nearest function-ish boundary.

  const immediateStart = Math.max(0, lineIdx - 10);
  for (let i = lineIdx - 1; i >= immediateStart; i -= 1) {
    if (ASSERT_RE.test(lines[i])) return true;
  }

  // Heuristic for "same function": walk backwards until we hit a likely function boundary.
  // We stop at an empty line followed by a function signature, or an export/function/const/class method signature.
  const boundaryRe = /^(\s*export\s+)?\s*(async\s+)?function\s+|^\s*(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(|^\s*(async\s+)?\w+\s*\([^)]*\)\s*\{|^\s*class\s+/;

  for (let i = lineIdx - 1; i >= 0; i -= 1) {
    if (ASSERT_RE.test(lines[i])) return true;

    // If we hit a probable start of a different function, stop searching.
    if (boundaryRe.test(lines[i]) && i < lineIdx - 2) {
      break;
    }
  }

  return false;
}

function scanFile(backendRoot: string, abs: string): { mutations: Mutation[]; violations: Mutation[] } {
  const rel = path.normalize(path.relative(backendRoot, abs));

  let content = "";
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return { mutations: [], violations: [] };
  }

  const lines = content.split(/\r?\n/);
  const mutations: Mutation[] = [];
  const violations: Mutation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (INTENT_ASSIGN_RE.test(line)) {
      const m: Mutation = {
        file: rel,
        line: i + 1,
        kind: "assign",
        snippet: getContextSnippet(lines, i),
      };
      mutations.push(m);
      if (!hasAssertionNear(lines, i)) violations.push(m);
      continue;
    }

    if (UPDATEONE_START_RE.test(line)) {
      const { block, endLineIdx } = extractBlock(lines, i);
      if (updateArgHasStatusWrite(block)) {
        const m: Mutation = {
          file: rel,
          line: i + 1,
          kind: "updateOne",
          snippet: getContextSnippet(lines, i),
        };
        mutations.push(m);
        if (!hasAssertionNear(lines, i)) violations.push(m);
      }
      i = Math.max(i, endLineIdx);
      continue;
    }

    if (FINDONEANDUPDATE_START_RE.test(line)) {
      const { block, endLineIdx } = extractBlock(lines, i);
      if (updateArgHasStatusWrite(block)) {
        const m: Mutation = {
          file: rel,
          line: i + 1,
          kind: "findOneAndUpdate",
          snippet: getContextSnippet(lines, i),
        };
        mutations.push(m);
        if (!hasAssertionNear(lines, i)) violations.push(m);
      }
      i = Math.max(i, endLineIdx);
      continue;
    }
  }

  return { mutations, violations };
}

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");
  if (!isDirectory(backendRoot)) {
    console.error(`[ci][check-paymentintent-transitions] Backend root not found: ${backendRoot}`);
    process.exit(1);
  }

  const files = walkTsFiles(backendRoot);

  const violations: Mutation[] = [];

  for (const abs of files) {
    const res = scanFile(backendRoot, abs);
    if (res.violations.length) violations.push(...res.violations);
  }

  if (violations.length > 0) {
    console.error("\n[CI INVARIANT FAILED] PaymentIntent status mutation missing assertAllowedTransition");
    console.error(
      "Detected a PaymentIntent status mutation (assignment/updateOne/findOneAndUpdate) without a nearby state-machine assertion.\n" +
        "Each status change must be guarded by paymentIntentStateMachine.assertAllowedTransition(from, to).\n"
    );

    const sorted = violations
      .slice()
      .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

    for (const v of sorted) {
      console.error(`\n--- ${v.file}:${v.line} [${v.kind}] ---`);
      console.error(v.snippet);
    }

    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-paymentintent-transitions] OK\n");
}

main();
