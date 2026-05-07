#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const phone = (process.argv[2] ?? "17757541197").trim();
if (!/^\d{6,}$/.test(phone)) {
  console.error(`[migrate] invalid phone "${phone}"`);
  process.exit(1);
}

const dataRoot = path.join(repoRoot, "data");
const accountRoot = path.join(dataRoot, "accounts", phone);

const ITEMS = [
  "database.sqlite",
  "database.sqlite-wal",
  "database.sqlite-shm",
  "database.sqlite-journal",
  "chat-attachments",
  "moments-media",
  "chat-stickers",
  "chat-backgrounds",
  "ai-speech",
  "self-agent-workspace",
];

function exists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

if (exists(accountRoot)) {
  const dbPath = path.join(accountRoot, "database.sqlite");
  if (exists(dbPath)) {
    console.log(`[migrate] ${accountRoot} already initialized — skipping`);
    process.exit(0);
  }
}

mkdirSync(accountRoot, { recursive: true });
console.log(`[migrate] target: ${accountRoot}`);

let movedCount = 0;
for (const item of ITEMS) {
  const src = path.join(dataRoot, item);
  if (!exists(src)) continue;
  const dst = path.join(accountRoot, item);
  if (exists(dst)) {
    console.log(`[migrate] skip ${item} (already at destination)`);
    continue;
  }
  try {
    renameSync(src, dst);
    console.log(`[migrate] moved ${item}`);
    movedCount += 1;
  } catch (err) {
    if (err && err.code === "EXDEV") {
      console.error(
        `[migrate] cross-device rename for ${item} not implemented; please move manually`,
      );
      process.exit(2);
    }
    throw err;
  }
}

if (movedCount === 0) {
  console.log(
    `[migrate] no source items present at ${dataRoot}; created empty account root`,
  );
} else {
  console.log(`[migrate] done — ${movedCount} item(s) moved into ${accountRoot}`);
}
