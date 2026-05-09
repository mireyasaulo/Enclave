#!/usr/bin/env node
// Smoke test: text + image + tts via 配置好的 provider_minimax 账户
// 直接读取一个租户库，模拟 inference.service 的 decodeSecret 逻辑，
// 然后调用 chat/completions（OpenAI 兼容）+ MiniMax 私有端点。

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const apiRequire = createRequire(
  path.join(REPO_ROOT, 'api', 'package.json'),
);
const Database = apiRequire('better-sqlite3');

const dbPath = path.join(
  REPO_ROOT,
  'data/accounts/91369527502636/database.sqlite',
);
if (!existsSync(dbPath)) {
  console.error('❌ DB not found:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const row = db
  .prepare(
    'SELECT * FROM inference_provider_accounts WHERE id = ?',
  )
  .get('provider_minimax');
db.close();
if (!row) {
  console.error('❌ provider_minimax not present in DB.');
  process.exit(1);
}

function decodeSecret(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (v.startsWith('plain:')) return v.slice(6).trim();
  if (v.startsWith('enc:')) {
    console.warn('⚠️ encountered enc: secret; this smoke test only handles plain:');
    return '';
  }
  return v;
}

const apiKey = decodeSecret(row.apiKeyEncrypted);
const ttsApiKey = decodeSecret(row.ttsApiKeyEncrypted) || apiKey;
const imageApiKey = decodeSecret(row.imageGenerationApiKeyEncrypted) || apiKey;

console.log('Using provider account:', {
  id: row.id,
  endpoint: row.endpoint,
  defaultModelId: row.defaultModelId,
  ttsModel: row.ttsModel,
  ttsVoice: row.ttsVoice,
  imageGenerationEndpoint: row.imageGenerationEndpoint,
  imageGenerationModel: row.imageGenerationModel,
  isDefault: row.isDefault,
  isEnabled: row.isEnabled,
});

async function testText() {
  console.log('\n— Testing chat (MiniMax-M2.7, OpenAI-compatible) —');
  const res = await fetch(`${row.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: row.defaultModelId,
      messages: [
        { role: 'user', content: '请用 8 个汉字以内自我介绍。' },
      ],
      max_tokens: 60,
    }),
  });
  const text = await res.text();
  console.log('  HTTP', res.status);
  try {
    const j = JSON.parse(text);
    console.log('  reply:', j.choices?.[0]?.message?.content?.trim() || j);
    return Boolean(j.choices?.[0]?.message);
  } catch {
    console.log('  raw:', text.slice(0, 300));
    return false;
  }
}

async function testImage() {
  console.log('\n— Testing image (image-01) —');
  const res = await fetch(`${row.imageGenerationEndpoint}/image_generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${imageApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: row.imageGenerationModel,
      prompt: 'a smiling cartoon cat in pastel colors',
      aspect_ratio: '1:1',
      n: 1,
      response_format: 'url',
      prompt_optimizer: false,
    }),
  });
  const text = await res.text();
  console.log('  HTTP', res.status);
  try {
    const j = JSON.parse(text);
    if (j.base_resp?.status_code !== 0) {
      console.log('  base_resp:', j.base_resp);
      return false;
    }
    const url = j.data?.image_urls?.[0];
    console.log('  image_url present:', Boolean(url));
    return Boolean(url);
  } catch {
    console.log('  raw:', text.slice(0, 300));
    return false;
  }
}

async function testTts() {
  console.log('\n— Testing TTS —');
  const res = await fetch(`${row.ttsEndpoint}/t2a_v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ttsApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: row.ttsModel,
      text: '你好，这是一段测试。',
      stream: false,
      voice_setting: {
        voice_id: row.ttsVoice || 'male-qn-qingse',
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    }),
  });
  const text = await res.text();
  console.log('  HTTP', res.status);
  try {
    const j = JSON.parse(text);
    if (j.base_resp?.status_code !== 0) {
      console.log('  base_resp:', j.base_resp);
      console.log(
        '  ⚠️ TTS 模型未在 Token Plan 中放行；后续可在 admin 控制台或 SQL 里把 ttsModel 换成 Token Plan 实际放行的型号。',
      );
      return false;
    }
    const audioHex = j.data?.audio;
    console.log('  audio bytes:', audioHex ? audioHex.length / 2 : 0);
    return Boolean(audioHex);
  } catch {
    console.log('  raw:', text.slice(0, 300));
    return false;
  }
}

const okText = await testText();
const okImage = await testImage();
const okTts = await testTts();

console.log('\n=== Result ===');
console.log('  text :', okText ? 'OK' : 'FAIL');
console.log('  image:', okImage ? 'OK' : 'FAIL');
console.log('  tts  :', okTts ? 'OK' : 'FAIL (可能因 Token Plan 模型名差异)');
