import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(scriptDir, "..");
const tauriDir = join(desktopDir, "src-tauri");
const mainRsPath = join(tauriDir, "src", "main.rs");

const REQUIRED_LOCALES = ["en-US", "ja-JP", "ko-KR", "_"];
const LPROJ_DIRS = ["zh-Hans.lproj", "en.lproj", "ja.lproj", "ko.lproj"];

const errors = [];

const mainRs = readFileSync(mainRsPath, "utf8");

const variants = extractEnumVariants(mainRs, "DesktopTextKey");
if (variants.length === 0) {
  fail("Could not extract DesktopTextKey enum variants from main.rs");
}

const desktopTextArms = extractMatchArms(mainRs, "desktop_text");
const desktopFormatUrlArms = extractMatchArms(mainRs, "desktop_format_url");

const formatUrlVariants = new Set();
for (const [variant, locales] of Object.entries(desktopFormatUrlArms)) {
  for (const arm of Object.values(locales)) {
    if (arm.text && arm.text.length > 0) {
      formatUrlVariants.add(variant);
      break;
    }
  }
}

let stringFunctionVariants = 0;
let formatFunctionVariants = 0;

for (const variant of variants) {
  if (formatUrlVariants.has(variant)) {
    formatFunctionVariants += 1;
    const locales = desktopFormatUrlArms[variant] ?? {};
    for (const locale of REQUIRED_LOCALES) {
      const arm = locales[locale];
      if (!arm) {
        errors.push(`desktop_format_url missing locale "${locale}" for ${variant}`);
        continue;
      }
      if (!arm.text || arm.text.trim().length === 0) {
        errors.push(
          `desktop_format_url ${variant} for "${locale}" is empty or whitespace-only`,
        );
        continue;
      }
      if (!arm.raw.includes("{url}")) {
        errors.push(
          `desktop_format_url ${variant} for "${locale}" does not interpolate {url}`,
        );
      }
    }
  } else {
    stringFunctionVariants += 1;
    const locales = desktopTextArms[variant] ?? {};
    for (const locale of REQUIRED_LOCALES) {
      const arm = locales[locale];
      if (!arm) {
        errors.push(`desktop_text missing locale "${locale}" for ${variant}`);
        continue;
      }
      if (!arm.text || arm.text.trim().length === 0) {
        errors.push(
          `desktop_text ${variant} for "${locale}" is empty or whitespace-only`,
        );
      }
    }
  }
}

const lprojReport = auditLprojFiles();

console.log("Desktop text audit");
console.log(`- DesktopTextKey variants: ${variants.length}`);
console.log(`  - Plain text (desktop_text): ${stringFunctionVariants}`);
console.log(`  - URL formatted (desktop_format_url): ${formatFunctionVariants}`);
console.log(`- Required locales per variant: ${REQUIRED_LOCALES.join(", ")}`);
console.log(
  `- InfoPlist.strings files: ${LPROJ_DIRS.length}, key set size: ${lprojReport.keyCount}`,
);

if (errors.length > 0) {
  console.error("");
  console.error("Desktop text audit failed:");
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log("Desktop text audit passed.");

function extractEnumVariants(source, enumName) {
  const enumRegex = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`, "m");
  const match = source.match(enumRegex);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((entry) => entry.replace(/\/\/.*/g, "").trim())
    .filter(Boolean);
}

function extractFunctionBody(source, fnName) {
  const fnRegex = new RegExp(`fn\\s+${fnName}\\s*\\(`);
  const fnIdx = source.search(fnRegex);
  if (fnIdx < 0) return null;
  const braceIdx = source.indexOf("{", fnIdx);
  if (braceIdx < 0) return null;
  return readBalancedBraces(source, braceIdx);
}

function readBalancedBraces(source, openIdx) {
  let depth = 0;
  let inStr = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && source[i + 1] === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      inLineComment = true;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      inBlockComment = true;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIdx + 1, i);
      }
    }
  }
  return null;
}

function extractMatchArms(source, fnName) {
  const body = extractFunctionBody(source, fnName);
  const arms = {};
  if (!body) return arms;

  // Locate the `match (locale, key) { ... }` block
  const matchIdx = body.search(/\bmatch\s*\(/);
  if (matchIdx < 0) return arms;
  const matchBraceIdx = body.indexOf("{", matchIdx);
  if (matchBraceIdx < 0) return arms;
  const matchBody = readBalancedBraces(body, matchBraceIdx);
  if (matchBody === null) return arms;

  let i = 0;
  while (i < matchBody.length) {
    while (i < matchBody.length && /\s/.test(matchBody[i])) i += 1;
    if (i >= matchBody.length) break;
    if (matchBody[i] !== "(") {
      // Skip stray content (comments etc.) until next newline.
      const nl = matchBody.indexOf("\n", i);
      i = nl < 0 ? matchBody.length : nl + 1;
      continue;
    }

    const armStart = i;
    const arrowIdx = findArrowAfter(matchBody, i);
    if (arrowIdx < 0) break;

    const patternText = matchBody.slice(armStart, arrowIdx).trim();
    const armBodyStart = arrowIdx + 2;
    const armBodyEnd = findArmEnd(matchBody, armBodyStart);
    const armBody = matchBody.slice(armBodyStart, armBodyEnd).trim();

    const pattern = parsePattern(patternText);
    if (pattern) {
      for (const { locale, variant } of pattern) {
        if (!arms[variant]) arms[variant] = {};
        arms[variant][locale] = {
          text: extractLiteral(armBody),
          raw: armBody,
        };
      }
    }

    i = armBodyEnd + 1;
  }

  return arms;
}

function findArrowAfter(text, fromIdx) {
  let depthParen = 0;
  let depthBrace = 0;
  let inStr = false;
  let escape = false;
  for (let i = fromIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen -= 1;
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") depthBrace -= 1;

    if (
      depthParen === 0 &&
      depthBrace === 0 &&
      ch === "=" &&
      text[i + 1] === ">"
    ) {
      return i;
    }
  }
  return -1;
}

function findArmEnd(text, fromIdx) {
  let i = fromIdx;
  while (i < text.length && /\s/.test(text[i])) i += 1;

  if (i < text.length && text[i] === "{") {
    // Block body — end at the matching `}` (Rust allows omitting trailing comma here).
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let j = i; j < text.length; j += 1) {
      const ch = text[j];
      if (inStr) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
    }
    return text.length;
  }

  // Expression body — terminate at top-level `,`.
  let depthParen = 0;
  let depthBrace = 0;
  let inStr = false;
  let escape = false;
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen -= 1;
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") {
      if (depthBrace === 0) return j;
      depthBrace -= 1;
    } else if (ch === "," && depthParen === 0 && depthBrace === 0) {
      return j;
    }
  }
  return text.length;
}

function parsePattern(patternText) {
  const parts = splitPatternAlternatives(patternText);
  const out = [];
  for (const part of parts) {
    const m = part.match(
      /^\(\s*(?:"([^"]+)"|(_))\s*,\s*DesktopTextKey::(\w+)\s*\)\s*$/,
    );
    if (!m) continue;
    const locale = m[1] ?? "_";
    const variant = m[3];
    out.push({ locale, variant });
  }
  return out.length > 0 ? out : null;
}

function splitPatternAlternatives(patternText) {
  const parts = [];
  let depth = 0;
  let inStr = false;
  let escape = false;
  let start = 0;
  for (let i = 0; i < patternText.length; i += 1) {
    const ch = patternText[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "|" && depth === 0) {
      parts.push(patternText.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(patternText.slice(start).trim());
  return parts.filter(Boolean);
}

function extractLiteral(armBody) {
  const formatMatch = armBody.match(/format!\s*\(\s*"((?:[^"\\]|\\.)*)"/);
  if (formatMatch) return formatMatch[1];
  const stringMatch = armBody.match(/"((?:[^"\\]|\\.)*)"/);
  if (stringMatch) return stringMatch[1];
  return "";
}

function auditLprojFiles() {
  const fileKeys = LPROJ_DIRS.map((dir) => {
    const file = join(tauriDir, dir, "InfoPlist.strings");
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch (err) {
      errors.push(`Cannot read ${file}: ${err.message}`);
      return { dir, keys: new Set() };
    }
    const keys = new Set();
    for (const match of content.matchAll(/"([^"]+)"\s*=\s*"([^"]*)"\s*;/g)) {
      const key = match[1];
      const value = match[2];
      keys.add(key);
      if (!value || value.trim().length === 0) {
        errors.push(`${dir}/InfoPlist.strings: key "${key}" has empty value`);
      }
    }
    return { dir, keys };
  });

  const allKeys = new Set();
  for (const { keys } of fileKeys) {
    for (const k of keys) allKeys.add(k);
  }

  for (const { dir, keys } of fileKeys) {
    for (const k of allKeys) {
      if (!keys.has(k)) {
        errors.push(`${dir}/InfoPlist.strings is missing key "${k}"`);
      }
    }
  }

  return { keyCount: allKeys.size };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
