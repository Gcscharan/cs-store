import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");
const srcDir = path.join(root, "src");

function maskCommentsAndStrings(src) {
  const out = src.split("");

  let i = 0;
  let state = "code";
  let quote = null;

  while (i < out.length) {
    const c = out[i];
    const next = i + 1 < out.length ? out[i + 1] : "";

    if (state === "code") {
      if (c === "/" && next === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
        state = "line_comment";
        continue;
      }
      if (c === "/" && next === "*") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
        state = "block_comment";
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        out[i] = " ";
        i += 1;
        state = "string";
        continue;
      }
      if (c === "`") {
        quote = "`";
        out[i] = " ";
        i += 1;
        state = "template";
        continue;
      }
      i += 1;
      continue;
    }

    if (state === "line_comment") {
      if (c === "\n") {
        state = "code";
        i += 1;
        continue;
      }
      out[i] = " ";
      i += 1;
      continue;
    }

    if (state === "block_comment") {
      if (c === "*" && next === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
        state = "code";
        continue;
      }
      if (c !== "\n") out[i] = " ";
      i += 1;
      continue;
    }

    if (state === "string") {
      if (c === "\\") {
        out[i] = " ";
        if (i + 1 < out.length) out[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === quote) {
        out[i] = " ";
        i += 1;
        state = "code";
        quote = null;
        continue;
      }
      if (c !== "\n") out[i] = " ";
      i += 1;
      continue;
    }

    if (state === "template") {
      if (c === "\\") {
        out[i] = " ";
        if (i + 1 < out.length) out[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === "`") {
        out[i] = " ";
        i += 1;
        state = "code";
        quote = null;
        continue;
      }
      if (c !== "\n") out[i] = " ";
      i += 1;
      continue;
    }

    i += 1;
  }

  return out.join("");
}

async function listSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await listSourceFiles(full)));
    } else if (ent.isFile()) {
      if ((ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) && !ent.name.endsWith(".bak")) {
        out.push(full);
      }
    }
  }

  return out;
}

function findNetworkFunctionNames(masked) {
  const names = new Set();
  const rx = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:useCallback\(\s*)?async\b/g;

  for (let m; (m = rx.exec(masked)); ) {
    const name = m[1];
    const start = m.index;
    const slice = masked.slice(start, start + 1800);
    if (/\b(fetch|axios)\s*\(|\btoApiUrl\s*\(/.test(slice)) {
      names.add(name);
    }
  }

  return [...names];
}

function isNetworkPollingCallback(snippet, networkFnNames) {
  if (/\b(fetch|axios)\s*\(|\btoApiUrl\s*\(/.test(snippet)) return true;
  for (const name of networkFnNames) {
    const rx = new RegExp(`\\b${name}\\s*\\(`);
    if (rx.test(snippet)) return true;
  }
  return false;
}

function extractCall(masked, callStartIndex) {
  const openIndex = masked.indexOf("(", callStartIndex);
  if (openIndex < 0) return null;

  let depth = 0;
  for (let i = openIndex; i < masked.length; i += 1) {
    const c = masked[i];
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) {
        return {
          openIndex,
          closeIndex: i,
          text: masked.slice(callStartIndex, i + 1),
        };
      }
    }
  }

  return null;
}

function findTimerFunctionNames(masked) {
  const names = new Set();

  const constRx = /\bconst\s+([A-Za-z_$][\w$]*)\s*=/g;
  for (let m; (m = constRx.exec(masked)); ) {
    const name = m[1];
    const slice = masked.slice(m.index, m.index + 1800);
    if (/\b(?:window\.)?setTimeout\s*\(|\b(?:window\.)?setInterval\s*\(/.test(slice)) {
      names.add(name);
    }
  }

  const fnRx = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  for (let m; (m = fnRx.exec(masked)); ) {
    const name = m[1];
    const slice = masked.slice(m.index, m.index + 1800);
    if (/\b(?:window\.)?setTimeout\s*\(|\b(?:window\.)?setInterval\s*\(/.test(slice)) {
      names.add(name);
    }
  }

  return [...names];
}

function getLeadingCallbackIdentifier(callText) {
  const start = callText.indexOf("(");
  if (start < 0) return null;

  const after = callText.slice(start + 1);
  const trimmed = after.replace(/^\s+/, "");

  if (trimmed.startsWith("(") || trimmed.startsWith("function")) return null;
  if (/^async\s*\(/.test(trimmed)) return null;
  if (/^async\s+function\b/.test(trimmed)) return null;

  const m = trimmed.match(/^([A-Za-z_$][\w$]*)\b/);
  return m ? m[1] : null;
}

function findFunctionDefinitionSlice(masked, name) {
  const patterns = [
    new RegExp(`\\bconst\\s+${name}\\b`, "g"),
    new RegExp(`\\bfunction\\s+${name}\\b`, "g"),
  ];

  for (const rx of patterns) {
    const m = rx.exec(masked);
    if (m) {
      return masked.slice(m.index, m.index + 4000);
    }
  }

  return null;
}

function hasVisibilityDiscipline(masked) {
  return /\bdocument\.visibilityState\b|\bvisibilitychange\b/.test(masked);
}

function hasAbortDiscipline(masked) {
  if (!/\bAbortController\b/.test(masked)) return false;
  if (!/\bsignal\b/.test(masked)) return false;
  return /\bsignal\s*:|\.signal\b/.test(masked);
}

function detectNetworkPolling(masked) {
  const hasNetwork = /\b(fetch|axios)\s*\(|\btoApiUrl\s*\(/.test(masked);
  if (!hasNetwork) return { polling: false };

  const networkFnNames = findNetworkFunctionNames(masked);
  const timerFnNames = findTimerFunctionNames(masked);

  const intervalRx = /\b(?:window\.)?setInterval\s*\(/g;
  for (let m; (m = intervalRx.exec(masked)); ) {
    const call = extractCall(masked, m.index);
    if (!call) continue;
    if (isNetworkPollingCallback(call.text, networkFnNames)) {
      return { polling: true, kind: "setInterval" };
    }
  }

  const timeoutRx = /\b(?:window\.)?setTimeout\s*\(/g;
  for (let m; (m = timeoutRx.exec(masked)); ) {
    const back = masked.slice(Math.max(0, m.index - 60), m.index);
    if (/\bnew\s+Promise\b/.test(back)) continue;

    const call = extractCall(masked, m.index);
    if (!call) continue;

    const cbName = getLeadingCallbackIdentifier(call.text);

    // Only treat setTimeout as polling when:
    // - a named callback is passed directly, AND
    // - that callback is self-rescheduling via setTimeout(callback, ...), AND
    // - that callback performs network I/O (directly or via known network helper).
    // This avoids false positives for one-off delayed network requests.
    if (!cbName) continue;

    const def = findFunctionDefinitionSlice(masked, cbName) || "";
    const isSelfRescheduling = new RegExp(`\\b(?:window\\.)?setTimeout\\s*\\(\\s*${cbName}\\b`).test(def);
    const isPollingLoop = isSelfRescheduling && isNetworkPollingCallback(def, networkFnNames);
    if (isPollingLoop) {
      return { polling: true, kind: "setTimeout" };
    }

    // Unused currently, but keep for future expansion without changing semantics.
    void timerFnNames;
  }

  return { polling: false };
}

async function main() {
  const files = await listSourceFiles(srcDir);
  const errors = [];

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const masked = maskCommentsAndStrings(raw);

    const det = detectNetworkPolling(masked);
    if (!det.polling) continue;

    if (det.kind === "setInterval") {
      errors.push({
        file,
        message: "Network polling via setInterval is forbidden. Use an abortable setTimeout/loop pattern that stops when hidden.",
      });
      continue;
    }

    if (!hasVisibilityDiscipline(masked)) {
      errors.push({
        file,
        message: "Network polling detected but no document.visibilityState / visibilitychange gating found.",
      });
    }

    if (!hasAbortDiscipline(masked)) {
      errors.push({
        file,
        message: "Network polling detected but no AbortController + fetch signal discipline found.",
      });
    }
  }

  if (errors.length > 0) {
    console.error("\nFrontend polling discipline check failed:\n");
    for (const e of errors) {
      console.error(`- ${path.relative(root, e.file)}: ${e.message}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log("Frontend polling discipline check passed.");
}

await main();
