import fs from "fs";
import path from "path";

type Violation = {
  file: string;
  handler: string;
  line: number;
  rule: string;
  snippet: string;
};

const TARGET_FILES = [
  path.normalize("src/controllers/cartController.ts"),
  path.normalize("src/domains/finance/controllers/paymentController.ts"),
  path.normalize("src/domains/finance/controllers/razorpayController.ts"),
  path.normalize("src/domains/finance/controllers/webhookController.ts"),
];

const LOCKED_HANDLERS_BY_FILE: Record<string, string[]> = {
  [path.normalize("src/controllers/cartController.ts")]: ["createOrder", "verifyPayment"],
  [path.normalize("src/domains/finance/controllers/paymentController.ts")]: ["createOrder", "verifyPayment"],
  [path.normalize("src/domains/finance/controllers/razorpayController.ts")]: [
    "createRazorpayOrder",
    "verifyRazorpayPayment",
    "handleRazorpayWebhook",
  ],
  [path.normalize("src/domains/finance/controllers/webhookController.ts")]: ["razorpayWebhook"],
};

const EARLY_RETURN_RE = /return\s+res\.status\(410\)\.json\(/;

const FORBIDDEN_RULES: Array<{ rule: string; re: RegExp }> = [
  {
    rule: "Order.update*",
    re: /\bOrder\.(update|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|bulkWrite)\b/,
  },
  {
    rule: "paymentStatus write/reference",
    re: /\bpaymentStatus\b/,
  },
  {
    rule: "inventory commit/reservation logic",
    re: /\binventoryReservationService\b|\bcommitReservationsForOrder\b|\breserveForOrder\b|\breleaseActiveReservationsForOrder\b/,
  },
  {
    rule: "razorpay verification/payment logic",
    re: /\brazorpay\b|\bRazorpay\b|\bcreateHmac\b|\brazorpay_signature\b|\bexpectedSignature\b|\bpayments\.fetch\b|\borders\.create\b/,
  },
];

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function indexToLine(content: string, idx: number): number {
  // 1-based line number
  let line = 1;
  for (let i = 0; i < idx && i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function getSnippetByLine(lines: string[], lineIdx: number): string {
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

function findMatchingBrace(text: string, openIdx: number): number {
  let depth = 0;

  let inStr: '"' | "'" | "`" | null = null;
  let escape = false;

  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inStr) {
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

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch as any;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function maskCommentsAndStrings(text: string): string {
  // Keep string length identical; replace comment/string contents with spaces (preserve newlines).
  const out = text.split("");

  let inStr: '"' | "'" | "`" | null = null;
  let escape = false;

  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < out.length; i += 1) {
    const ch = out[i];
    const next = i + 1 < out.length ? out[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        continue;
      }
      out[i] = " ";
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        inBlockComment = false;
        i += 1;
        continue;
      }
      if (ch !== "\n") out[i] = " ";
      continue;
    }

    if (inStr) {
      if (escape) {
        escape = false;
        if (ch !== "\n") out[i] = " ";
        continue;
      }
      if (ch === "\\") {
        escape = true;
        out[i] = " ";
        continue;
      }
      if (ch === inStr) {
        out[i] = " ";
        inStr = null;
        continue;
      }
      if (ch !== "\n") out[i] = " ";
      continue;
    }

    if (ch === "/" && next === "/") {
      out[i] = " ";
      out[i + 1] = " ";
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      out[i] = " ";
      inStr = ch as any;
      continue;
    }
  }

  return out.join("");
}

function findExportConstFunctions(content: string): Array<{ name: string; startIdx: number; bodyStartIdx: number; bodyEndIdx: number }> {
  const out: Array<{ name: string; startIdx: number; bodyStartIdx: number; bodyEndIdx: number }> = [];
  const re = /export\s+const\s+(\w+)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const name = m[1];
    const startIdx = m.index;

    const bodyStartIdx = content.indexOf("{", re.lastIndex);
    if (bodyStartIdx < 0) continue;

    const bodyEndIdx = findMatchingBrace(content, bodyStartIdx);
    if (bodyEndIdx < 0) continue;

    out.push({ name, startIdx, bodyStartIdx, bodyEndIdx });
    re.lastIndex = bodyEndIdx + 1;
  }

  return out;
}

function scanFile(backendRoot: string, relPath: string): Violation[] {
  const abs = path.join(backendRoot, relPath);
  let content = "";
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return [
      {
        file: relPath,
        handler: "(file)",
        line: 1,
        rule: "missing file",
        snippet: `Could not read ${relPath}`,
      },
    ];
  }

  const lines = content.split(/\r?\n/);
  const fns = findExportConstFunctions(content);
  const violations: Violation[] = [];

  const lockedHandlers = LOCKED_HANDLERS_BY_FILE[relPath] || [];
  const fnByName = new Map(fns.map((f) => [f.name, f] as const));

  for (const handlerName of lockedHandlers) {
    const fn = fnByName.get(handlerName);
    if (!fn) {
      violations.push({
        file: relPath,
        handler: handlerName,
        line: 1,
        rule: "missing legacy handler export",
        snippet: `Expected export const ${handlerName} in ${relPath}`,
      });
      continue;
    }

    const bodyText = content.slice(fn.bodyStartIdx + 1, fn.bodyEndIdx);
    const has410 = EARLY_RETURN_RE.test(bodyText);

    if (!has410) {
      const approxLine = indexToLine(content, fn.bodyStartIdx);
      violations.push({
        file: relPath,
        handler: fn.name,
        line: approxLine,
        rule: "missing return res.status(410).json(...)",
        snippet: getSnippetByLine(lines, Math.max(0, approxLine - 1)),
      });
      continue;
    }

    const match = bodyText.match(EARLY_RETURN_RE);
    if (!match || match.index == null) continue;

    const afterReturn = bodyText.slice(match.index + match[0].length);
    const afterReturnMasked = maskCommentsAndStrings(afterReturn);

    for (const rule of FORBIDDEN_RULES) {
      const r = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
      let mm: RegExpExecArray | null;
      while ((mm = r.exec(afterReturnMasked))) {
        const absIdx = fn.bodyStartIdx + 1 + (match.index + match[0].length) + mm.index;
        const lineNo = indexToLine(content, absIdx);
        violations.push({
          file: relPath,
          handler: fn.name,
          line: lineNo,
          rule: rule.rule,
          snippet: getSnippetByLine(lines, Math.max(0, lineNo - 1)),
        });
      }
    }
  }

  return violations;
}

function main(): void {
  const backendRoot = path.resolve(__dirname, "../..");
  if (!isDirectory(backendRoot)) {
    console.error(`[ci][check-legacy-payment-lock] Backend root not found: ${backendRoot}`);
    process.exit(1);
  }

  const violations: Violation[] = [];
  for (const rel of TARGET_FILES) {
    violations.push(...scanFile(backendRoot, rel));
  }

  if (violations.length > 0) {
    console.error("\n[CI INVARIANT FAILED] Legacy payment endpoints are not hard-locked");
    console.error(
      "Legacy payment handlers must remain hard-disabled (410-only early return).\n" +
        "Forbidden logic must not appear after `return res.status(410).json(...)`.\n"
    );

    const sorted = violations
      .slice()
      .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

    for (const v of sorted) {
      console.error(`\n--- ${v.file}:${v.line} [${v.handler}] forbidden: ${v.rule} ---`);
      console.error(v.snippet);
    }

    console.error("");
    process.exit(1);
  }

  process.stdout.write("[ci][check-legacy-payment-lock] OK\n");
}

main();
