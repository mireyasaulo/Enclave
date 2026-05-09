#!/usr/bin/env node
// 一次性脚本：用 sharp 把 public/screenshots/**/*.png 做 lossless 优化（palette + max
// compression）。只在新文件比旧文件小时回写，不改文件名、不改业务组件 src。
// 跑一次即可：node apps/site/scripts/optimize-screenshots.mjs
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, "..", "public", "screenshots");

async function* walkPng(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkPng(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) yield full;
  }
}

async function optimizeOne(file) {
  const before = (await stat(file)).size;
  const input = await readFile(file);
  const output = await sharp(input)
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toBuffer();
  if (output.length < before) {
    await writeFile(file, output);
    return { file, before, after: output.length, written: true };
  }
  return { file, before, after: output.length, written: false };
}

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  let touched = 0;
  for await (const file of walkPng(screenshotsDir)) {
    const result = await optimizeOne(file);
    totalBefore += result.before;
    totalAfter += result.written ? result.after : result.before;
    if (result.written) touched += 1;
    const rel = path.relative(screenshotsDir, file);
    const delta = result.before - (result.written ? result.after : result.before);
    const pct = result.before ? ((delta / result.before) * 100).toFixed(1) : "0.0";
    console.log(
      `${result.written ? "✓" : "·"} ${rel}  ${(result.before / 1024).toFixed(1)}KB -> ${(
        (result.written ? result.after : result.before) / 1024
      ).toFixed(1)}KB  (${pct}% ↓)`,
    );
  }
  console.log(
    `\nDone. Rewrote ${touched} file(s).  Total ${(totalBefore / 1024).toFixed(1)}KB -> ${(
      totalAfter / 1024
    ).toFixed(1)}KB  (${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}% ↓)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
