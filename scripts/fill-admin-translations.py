#!/usr/bin/env python3
"""
Batch-translate untranslated admin PO entries using the Claude CLI.
Handles both empty msgstr and msgstr==msgid (copied-source) entries.
Usage: python3 scripts/fill-admin-translations.py [--lang en-US ja-JP ko-KR]
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
CATALOG_DIR = ROOT / "packages/i18n/catalogs/admin"

LANG_NAMES = {
    "en-US": "English",
    "ja-JP": "Japanese",
    "ko-KR": "Korean",
}

CONTEXT = "这是一个 AI 角色管理后台，字段为游戏角色属性、运营状态标签和系统提示词。翻译应简洁专业，保留占位符 {0} {1} 等不变，保留换行符，不添加多余标点。"

BATCH_SIZE = 50


def parse_po(filepath: Path) -> list[dict]:
    """Parse PO file into a list of entry dicts."""
    content = filepath.read_text(encoding="utf-8")
    blocks = re.split(r"\n\n+", content)
    entries = []
    for block in blocks:
        lines = block.strip().split("\n")
        entry = {"block": block, "lines": lines, "msgid": None, "msgstr": None, "msgid_start": -1, "msgstr_start": -1}
        i = 0
        while i < len(lines):
            line = lines[i]
            if entry["msgid"] is None and line.startswith("msgid "):
                entry["msgid_start"] = i
                raw = line[6:]
                while i + 1 < len(lines) and lines[i + 1].startswith('"'):
                    i += 1
                    raw += lines[i]
                try:
                    entry["msgid"] = json.loads(raw)
                except Exception:
                    pass
            elif entry["msgstr"] is None and line.startswith("msgstr "):
                entry["msgstr_start"] = i
                raw = line[7:]
                while i + 1 < len(lines) and lines[i + 1].startswith('"'):
                    i += 1
                    raw += lines[i]
                try:
                    entry["msgstr"] = json.loads(raw)
                except Exception:
                    pass
            i += 1
        entries.append(entry)
    return entries


def needs_translation(entry: dict) -> bool:
    msgid = entry.get("msgid")
    msgstr = entry.get("msgstr")
    if msgid is None or msgid == "":
        return False
    if msgstr is None or msgstr == "" or msgstr == msgid:
        return True
    return False


def translate_batch(strings: list[str], target_lang: str) -> dict[str, str]:
    """Call claude CLI to translate a batch of strings. Returns {zh: translated} dict."""
    lang_name = LANG_NAMES.get(target_lang, target_lang)

    items = [{"id": i, "zh": s} for i, s in enumerate(strings)]
    prompt = f"""请将以下中文字符串翻译为{lang_name}。

背景：{CONTEXT}

要求：
- 仅输出 JSON 对象，格式为 {{"id": "translation"}}
- id 对应输入的 id 字段
- 保留所有占位符 {{0}} {{1}} 等（花括号）不变
- 不要添加解释文字，只输出 JSON

输入：
{json.dumps(items, ensure_ascii=False, indent=2)}

输出（仅 JSON）："""

    result = subprocess.run(
        ["claude", "--print"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        print(f"  ERROR: claude CLI failed: {result.stderr[:200]}", file=sys.stderr)
        return {}

    # Extract JSON: try markdown block first, then raw JSON object
    raw_out = result.stdout.strip()
    md_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_out, re.DOTALL)
    if md_match:
        raw = md_match.group(1)
    else:
        # Find outermost { ... }
        try:
            start = raw_out.index('{')
            end = raw_out.rindex('}') + 1
            raw = raw_out[start:end]
        except ValueError:
            raw = raw_out

    try:
        id_to_tr = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  ERROR: failed to parse JSON response: {e}", file=sys.stderr)
        print(f"  Raw response (first 300 chars): {result.stdout[:300]}", file=sys.stderr)
        return {}

    # Map id → translation back to zh → translation
    result_map = {}
    for item in items:
        key = str(item["id"])
        if key in id_to_tr:
            result_map[item["zh"]] = id_to_tr[key]

    return result_map


def fill_po(filepath: Path, translations: dict[str, str]) -> int:
    """Apply translations to PO file. Returns number of entries filled."""
    content = filepath.read_text(encoding="utf-8")
    blocks = re.split(r"(\n\n+)", content)

    filled = 0
    result_blocks = []

    i = 0
    while i < len(blocks):
        block = blocks[i]
        separator = blocks[i + 1] if i + 1 < len(blocks) and blocks[i + 1].startswith("\n\n") else ""

        # Parse msgid and msgstr from block
        lines = block.split("\n")
        msgid = None
        msgstr = None
        msgstr_line_idx = -1
        msgstr_end_idx = -1

        j = 0
        while j < len(lines):
            line = lines[j]
            if msgid is None and line.startswith("msgid "):
                raw = line[6:]
                k = j + 1
                while k < len(lines) and lines[k].startswith('"'):
                    raw += lines[k]
                    k += 1
                try:
                    msgid = json.loads(raw)
                except Exception:
                    pass
                j = k
                continue
            if msgstr is None and line.startswith("msgstr "):
                msgstr_line_idx = j
                raw = line[7:]
                k = j + 1
                while k < len(lines) and lines[k].startswith('"'):
                    raw += lines[k]
                    k += 1
                msgstr_end_idx = k - 1
                try:
                    msgstr = json.loads(raw)
                except Exception:
                    pass
                j = k
                continue
            j += 1

        # Replace msgstr if needed
        if (msgid and msgid != "" and
                msgstr_line_idx >= 0 and
                (msgstr == "" or msgstr == msgid) and
                msgid in translations):
            tr = translations[msgid]
            new_lines = (
                lines[:msgstr_line_idx] +
                [f"msgstr {json.dumps(tr, ensure_ascii=False)}"] +
                lines[msgstr_end_idx + 1:]
            )
            result_blocks.append("\n".join(new_lines))
            filled += 1
        else:
            result_blocks.append(block)

        if separator:
            result_blocks.append(separator)
            i += 2
        else:
            i += 1

    filepath.write_text("".join(result_blocks), encoding="utf-8")
    return filled


def process_language(lang: str) -> None:
    po_path = CATALOG_DIR / f"{lang}.po"
    print(f"\n{'='*60}")
    print(f"Processing {lang} ({LANG_NAMES.get(lang, lang)})")
    print(f"{'='*60}")

    entries = parse_po(po_path)
    to_translate = [e for e in entries if needs_translation(e)]
    strings = [e["msgid"] for e in to_translate]

    print(f"Found {len(strings)} untranslated strings")

    all_translations: dict[str, str] = {}

    # Process in batches
    total_batches = (len(strings) + BATCH_SIZE - 1) // BATCH_SIZE
    for batch_num in range(total_batches):
        batch = strings[batch_num * BATCH_SIZE : (batch_num + 1) * BATCH_SIZE]
        print(f"  Batch {batch_num + 1}/{total_batches} ({len(batch)} strings)...", end=" ", flush=True)

        batch_translations = translate_batch(batch, lang)
        all_translations.update(batch_translations)

        print(f"got {len(batch_translations)}/{len(batch)}")

        # Save intermediate results every 5 batches
        if (batch_num + 1) % 5 == 0 or batch_num == total_batches - 1:
            filled = fill_po(po_path, all_translations)
            print(f"  [checkpoint] Filled {filled} entries so far")
            all_translations = {}  # Reset after writing

        # Small delay between batches
        if batch_num < total_batches - 1:
            time.sleep(0.5)

    # Final fill
    if all_translations:
        filled = fill_po(po_path, all_translations)
        print(f"  Final fill: {filled} entries")

    # Count remaining untranslated
    entries2 = parse_po(po_path)
    remaining = sum(1 for e in entries2 if needs_translation(e))
    print(f"Done {lang}: {len(strings) - remaining} filled, {remaining} remaining")


def main():
    langs = sys.argv[1:] if len(sys.argv) > 1 else ["en-US", "ja-JP", "ko-KR"]

    print(f"Admin PO batch translator")
    print(f"Languages: {', '.join(langs)}")
    print(f"Batch size: {BATCH_SIZE}")

    for lang in langs:
        process_language(lang)

    print("\n\nAll done! Run: pnpm i18n:compile --typescript")


if __name__ == "__main__":
    main()
