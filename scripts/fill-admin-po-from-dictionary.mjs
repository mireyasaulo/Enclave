#!/usr/bin/env node
// Fill empty msgstr in packages/i18n/catalogs/admin/{en-US,ja-JP,ko-KR}.po
// using the EN/JA/KO_EXACT_TRANSLATIONS maps inside apps/admin/src/lib/admin-ui-translation.ts.
// Idempotent: only fills entries whose msgstr is currently empty.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ADMIN_DICT = path.join(ROOT, "apps/admin/src/lib/admin-ui-translation.ts");
const CATALOG_DIR = path.join(ROOT, "packages/i18n/catalogs/admin");

function loadDictionary() {
  const text = readFileSync(ADMIN_DICT, "utf8");
  const out = { "en-US": new Map(), "ja-JP": new Map(), "ko-KR": new Map() };
  const lines = text.split("\n");
  const blockStart = (name) => lines.findIndex((l) => l.includes(`const ${name} = new Map`));
  const blockEnd = (start) => {
    for (let i = start + 1; i < Math.min(lines.length, start + 4000); i++) {
      if (lines[i].includes("right[0].length - left[0].length")) return i;
    }
    return lines.length - 1;
  };
  const pairRe = /\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\]/g;
  for (const [name, locale] of [
    ["EN_EXACT_TRANSLATIONS", "en-US"],
    ["JA_EXACT_TRANSLATIONS", "ja-JP"],
    ["KO_EXACT_TRANSLATIONS", "ko-KR"],
  ]) {
    const s = blockStart(name);
    if (s < 0) continue;
    const e = blockEnd(s);
    const body = lines.slice(s, e + 1).join("\n");
    let m;
    pairRe.lastIndex = 0;
    while ((m = pairRe.exec(body)) !== null) {
      const zh = JSON.parse(`"${m[1]}"`);
      const tr = JSON.parse(`"${m[2]}"`);
      out[locale].set(zh, tr);
    }
  }
  return out;
}

function fillPo(filePath, lookup) {
  const original = readFileSync(filePath, "utf8");
  // Parse simple lingui PO: blocks separated by blank lines.
  // For each block, find msgid (possibly multiline) and msgstr (possibly multiline).
  // If msgstr is currently empty (msgstr "") and msgid has a lookup, replace.
  const blocks = original.split(/\n\n+/);
  let filled = 0;
  const next = blocks.map((block) => {
    const lines = block.split("\n");
    let i = 0;
    let msgidStart = -1;
    let msgidEnd = -1;
    let msgstrStart = -1;
    let msgstrEnd = -1;
    while (i < lines.length) {
      const line = lines[i];
      if (msgidStart < 0 && line.startsWith("msgid ")) {
        msgidStart = i;
        msgidEnd = i;
        // Continuation lines start with a quote
        while (msgidEnd + 1 < lines.length && lines[msgidEnd + 1].startsWith("\"")) {
          msgidEnd++;
        }
        i = msgidEnd + 1;
        continue;
      }
      if (msgstrStart < 0 && line.startsWith("msgstr ")) {
        msgstrStart = i;
        msgstrEnd = i;
        while (msgstrEnd + 1 < lines.length && lines[msgstrEnd + 1].startsWith("\"")) {
          msgstrEnd++;
        }
        break;
      }
      i++;
    }
    if (msgidStart < 0 || msgstrStart < 0) return block;
    // Reconstruct msgid string content
    const msgidRaw = lines
      .slice(msgidStart, msgidEnd + 1)
      .map((l) => l.replace(/^msgid /, ""))
      .join("");
    const msgstrRaw = lines
      .slice(msgstrStart, msgstrEnd + 1)
      .map((l) => l.replace(/^msgstr /, ""))
      .join("");
    let msgid;
    let msgstr;
    try {
      msgid = JSON.parse(msgidRaw);
      msgstr = JSON.parse(msgstrRaw);
    } catch {
      return block;
    }
    // Skip the metadata block (msgid "")
    if (msgid === "") return block;
    if (msgstr.length > 0) return block; // already translated
    const tr = lookup.get(msgid);
    if (!tr) return block;
    // Write a single-line msgstr replacing all msgstr-related lines.
    const replaced = [
      ...lines.slice(0, msgstrStart),
      `msgstr ${JSON.stringify(tr)}`,
      ...lines.slice(msgstrEnd + 1),
    ];
    filled++;
    return replaced.join("\n");
  });
  if (filled > 0) {
    writeFileSync(filePath, next.join("\n\n"));
  }
  return filled;
}

function main() {
  const dict = loadDictionary();
  for (const [locale, fname] of [
    ["en-US", "en-US.po"],
    ["ja-JP", "ja-JP.po"],
    ["ko-KR", "ko-KR.po"],
  ]) {
    const p = path.join(CATALOG_DIR, fname);
    const filled = fillPo(p, dict[locale]);
    const mapSize = dict[locale].size;
    console.log(`${fname}: filled ${filled} entries (dict size ${mapSize})`);
  }
}

main();
