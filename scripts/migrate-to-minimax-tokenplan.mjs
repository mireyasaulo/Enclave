#!/usr/bin/env node
// 把租户库的默认推理通道从 1n1 切到 MiniMax Token Plan，并把 character_override 角色硬绑回 1n1。
// 用法：
//   node scripts/migrate-to-minimax-tokenplan.mjs --dry-run
//   node scripts/migrate-to-minimax-tokenplan.mjs
//   node scripts/migrate-to-minimax-tokenplan.mjs --rollback
//
// 环境变量（必填）：
//   MINIMAX_API_KEY    — sk-cp-... 形式的 Token Plan key
//   MINIMAX_BASE_URL   — 默认 https://api.minimaxi.com/v1

import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname0 = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_BOOT = path.resolve(__dirname0, '..');
const apiRequire = createRequire(
  path.join(REPO_ROOT_BOOT, 'api', 'package.json'),
);
const Database = apiRequire('better-sqlite3');

// 从仓库根 .env / api/.env 里加载 MINIMAX_* 变量（不依赖 dotenv 模块）
function loadDotenv(filePath) {
  if (!existsSync(filePath)) return;
  const txt = readFileSync(filePath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k] !== undefined && process.env[k] !== '') continue;
    let v = vRaw;
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadDotenv(path.join(REPO_ROOT_BOOT, '.env'));
loadDotenv(path.join(REPO_ROOT_BOOT, 'api', '.env'));

const __dirname = __dirname0;
const REPO_ROOT = REPO_ROOT_BOOT;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const ROLLBACK = args.has('--rollback');

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY?.trim();
const MINIMAX_BASE_URL =
  process.env.MINIMAX_BASE_URL?.trim() || 'https://api.minimaxi.com/v1';

const PROVIDER_ID = 'provider_minimax';
const TEXT_MODEL = 'MiniMax-M2.7';
const IMAGE_MODEL = 'image-01';
const TTS_MODEL = 'speech-02-hd';
const TTS_VOICE = 'male-qn-qingse';

if (!ROLLBACK && !MINIMAX_API_KEY) {
  console.error('❌ MINIMAX_API_KEY 未设置（rootRepo/.env 或 export）。');
  process.exit(1);
}

function discoverDatabases() {
  const candidates = [];
  const root = path.join(REPO_ROOT, 'data', 'database.sqlite');
  if (existsSync(root)) candidates.push(root);
  const accountsDir = path.join(REPO_ROOT, 'data', 'accounts');
  if (existsSync(accountsDir) && statSync(accountsDir).isDirectory()) {
    for (const entry of readdirSync(accountsDir)) {
      const dbPath = path.join(accountsDir, entry, 'database.sqlite');
      if (existsSync(dbPath)) candidates.push(dbPath);
    }
  }
  return candidates;
}

function tableExists(db, name) {
  const row = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
    )
    .get(name);
  return Boolean(row);
}

function migrateOne(dbPath) {
  const db = new Database(dbPath);
  const summary = {
    dbPath,
    skipped: false,
    insertedProvider: false,
    demotedDefault: 0,
    boundOverrides: 0,
    error: null,
  };

  try {
    if (
      !tableExists(db, 'inference_provider_accounts') ||
      !tableExists(db, 'characters')
    ) {
      summary.skipped = true;
      return summary;
    }

    const plainKey = `plain:${MINIMAX_API_KEY}`;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      const exists = db
        .prepare(
          'SELECT 1 FROM inference_provider_accounts WHERE id = ?',
        )
        .get(PROVIDER_ID);
      if (!exists) {
        const insert = db.prepare(`
          INSERT INTO inference_provider_accounts (
            id, name, providerKind, endpoint, defaultModelId,
            apiKeyEncrypted, mode, apiStyle,
            transcriptionEndpoint, transcriptionModel, transcriptionApiKeyEncrypted,
            ttsEndpoint, ttsModel, ttsApiKeyEncrypted, ttsVoice,
            imageGenerationEndpoint, imageGenerationModel, imageGenerationApiKeyEncrypted,
            isDefault, isEnabled, notes,
            createdAt, updatedAt
          ) VALUES (
            @id, @name, @providerKind, @endpoint, @defaultModelId,
            @apiKey, @mode, @apiStyle,
            NULL, NULL, NULL,
            @ttsEndpoint, @ttsModel, @ttsApiKey, @ttsVoice,
            @imageEndpoint, @imageModel, @imageApiKey,
            1, 1, @notes,
            @now, @now
          )
        `);
        insert.run({
          id: PROVIDER_ID,
          name: 'MiniMax Token Plan',
          providerKind: 'openai_compatible',
          endpoint: MINIMAX_BASE_URL,
          defaultModelId: TEXT_MODEL,
          apiKey: plainKey,
          mode: 'cloud',
          apiStyle: 'openai-chat-completions',
          ttsEndpoint: MINIMAX_BASE_URL,
          ttsModel: TTS_MODEL,
          ttsApiKey: plainKey,
          ttsVoice: TTS_VOICE,
          imageEndpoint: MINIMAX_BASE_URL,
          imageModel: IMAGE_MODEL,
          imageApiKey: plainKey,
          notes:
            'Auto-installed by migrate-to-minimax-tokenplan.mjs. TTS model 名若被 Token Plan 拒绝(2061), 回这一行改 ttsModel 即可。',
          now,
        });
        summary.insertedProvider = true;
      }

      const demote = db
        .prepare(
          "UPDATE inference_provider_accounts SET isDefault = 0, updatedAt = ? WHERE id != ? AND isDefault = 1",
        )
        .run(now, PROVIDER_ID);
      summary.demotedDefault = demote.changes;

      db.prepare(
        'UPDATE inference_provider_accounts SET isDefault = 1, updatedAt = ? WHERE id = ?',
      ).run(now, PROVIDER_ID);

      const bind = db
        .prepare(
          `UPDATE characters
             SET inferenceProviderAccountId = 'provider_default'
             WHERE modelRoutingMode = 'character_override'
               AND (inferenceProviderAccountId IS NULL OR inferenceProviderAccountId = '')`,
        )
        .run();
      summary.boundOverrides = bind.changes;
    });

    if (DRY_RUN) {
      // 先尝试一次再回滚以拿到 changes 数；用 savepoint 实现
      db.prepare('BEGIN').run();
      try {
        const exists = db
          .prepare(
            'SELECT 1 FROM inference_provider_accounts WHERE id = ?',
          )
          .get(PROVIDER_ID);
        summary.insertedProvider = !exists;

        const demoteRes = db
          .prepare(
            "SELECT COUNT(*) AS c FROM inference_provider_accounts WHERE id != ? AND isDefault = 1",
          )
          .get(PROVIDER_ID);
        summary.demotedDefault = demoteRes.c;

        const bindRes = db
          .prepare(
            `SELECT COUNT(*) AS c FROM characters
               WHERE modelRoutingMode = 'character_override'
                 AND (inferenceProviderAccountId IS NULL OR inferenceProviderAccountId = '')`,
          )
          .get();
        summary.boundOverrides = bindRes.c;
      } finally {
        db.prepare('ROLLBACK').run();
      }
    } else {
      tx();
    }
  } catch (err) {
    summary.error = err.message ?? String(err);
  } finally {
    db.close();
  }

  return summary;
}

function rollbackOne(dbPath) {
  const db = new Database(dbPath);
  const summary = {
    dbPath,
    skipped: false,
    deletedProvider: false,
    restoredDefault: 0,
    error: null,
  };
  try {
    if (!tableExists(db, 'inference_provider_accounts')) {
      summary.skipped = true;
      return summary;
    }
    const tx = db.transaction(() => {
      const del = db
        .prepare('DELETE FROM inference_provider_accounts WHERE id = ?')
        .run(PROVIDER_ID);
      summary.deletedProvider = del.changes > 0;
      const restore = db
        .prepare(
          "UPDATE inference_provider_accounts SET isDefault = 1, updatedAt = datetime('now') WHERE id = 'provider_default'",
        )
        .run();
      summary.restoredDefault = restore.changes;
    });
    if (DRY_RUN) {
      db.prepare('BEGIN').run();
      try {
        const exists = db
          .prepare(
            'SELECT 1 FROM inference_provider_accounts WHERE id = ?',
          )
          .get(PROVIDER_ID);
        summary.deletedProvider = Boolean(exists);
        const cnt = db
          .prepare(
            "SELECT COUNT(*) AS c FROM inference_provider_accounts WHERE id = 'provider_default'",
          )
          .get();
        summary.restoredDefault = cnt.c;
      } finally {
        db.prepare('ROLLBACK').run();
      }
    } else {
      tx();
    }
  } catch (err) {
    summary.error = err.message ?? String(err);
  } finally {
    db.close();
  }
  return summary;
}

function main() {
  const dbs = discoverDatabases();
  if (dbs.length === 0) {
    console.error('❌ 没有找到任何 SQLite 数据库（data/database.sqlite 或 data/accounts/*/database.sqlite）。');
    process.exit(1);
  }

  console.log(
    `${ROLLBACK ? '🔁 ROLLBACK' : '➡️  MIGRATE'}${DRY_RUN ? ' (dry-run)' : ''} | ${dbs.length} 个数据库\n`,
  );

  let inserted = 0;
  let demoted = 0;
  let bound = 0;
  let errors = 0;

  for (const db of dbs) {
    const rel = path.relative(REPO_ROOT, db);
    const r = ROLLBACK ? rollbackOne(db) : migrateOne(db);
    if (r.skipped) {
      console.log(`  ⏭  ${rel}  (skipped: 缺少 inference 表)`);
      continue;
    }
    if (r.error) {
      errors++;
      console.error(`  ❌ ${rel}  ${r.error}`);
      continue;
    }
    if (ROLLBACK) {
      console.log(
        `  ✓ ${rel}  deleted=${r.deletedProvider}  restoredDefault=${r.restoredDefault}`,
      );
    } else {
      if (r.insertedProvider) inserted++;
      demoted += r.demotedDefault;
      bound += r.boundOverrides;
      console.log(
        `  ✓ ${rel}  inserted=${r.insertedProvider}  demotedDefault=${r.demotedDefault}  boundOverrides=${r.boundOverrides}`,
      );
    }
  }

  if (!ROLLBACK) {
    console.log(
      `\n汇总：新建 provider_minimax = ${inserted} 个库，旧默认降级 ${demoted} 行，override 角色硬绑 ${bound} 个。`,
    );
  }
  if (errors > 0) process.exit(1);
}

main();
