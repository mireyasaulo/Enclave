#!/usr/bin/env node
// Apply a zh→target translation map (JSON file) to one or more admin .po catalogs.
// Usage: node scripts/fill-admin-po-from-json.mjs <translations.json> <locale>...
// e.g.   node scripts/fill-admin-po-from-json.mjs scripts/admin-i18n-en-fills.json en-US

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_DIR = path.join(ROOT, "packages/i18n/catalogs/admin");

const [, , jsonPath, ...locales] = process.argv;
if (!jsonPath || locales.length === 0) {
  console.error(
    "usage: node scripts/fill-admin-po-from-json.mjs <translations.json> <locale>...",
  );
  process.exit(1);
}

const translations = JSON.parse(readFileSync(jsonPath, "utf8"));
const map = new Map(Object.entries(translations));

function fillPo(filePath) {
  const original = readFileSync(filePath, "utf8");
  const blocks = original.split(/\n\n+/);
  let filled = 0;
  const next = blocks.map((block) => {
    const lines = block.split("\n");
    let msgidStart = -1;
    let msgidEnd = -1;
    let msgstrStart = -1;
    let msgstrEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (msgidStart < 0 && line.startsWith("msgid ")) {
        msgidStart = i;
        msgidEnd = i;
        while (msgidEnd + 1 < lines.length && lines[msgidEnd + 1].startsWith("\"")) {
          msgidEnd++;
        }
        i = msgidEnd;
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
    }
    if (msgidStart < 0 || msgstrStart < 0) return block;
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
    if (msgid === "" || msgstr.length > 0) return block;
    const tr = map.get(msgid);
    if (!tr) return block;
    const replaced = [
      ...lines.slice(0, msgstrStart),
      `msgstr ${JSON.stringify(tr)}`,
      ...lines.slice(msgstrEnd + 1),
    ];
    filled++;
    return replaced.join("\n");
  });
  if (filled > 0) writeFileSync(filePath, next.join("\n\n"));
  return filled;
}

for (const locale of locales) {
  const p = path.join(CATALOG_DIR, `${locale}.po`);
  const filled = fillPo(p);
  console.log(`${locale}.po: filled ${filled} entries from ${jsonPath}`);
}
