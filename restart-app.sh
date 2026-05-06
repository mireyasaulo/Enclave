#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

export CLOUD_LOCAL_PROCESS_PROVIDER="${CLOUD_LOCAL_PROCESS_PROVIDER:-1}"

echo "[restart-app] 0/4 准备账号数据 (默认 17757541197)..."
if [ ! -f data/accounts/17757541197/database.sqlite ]; then
  if [ -f data/database.sqlite ]; then
    echo "[restart-app] 检测到老 data/database.sqlite，迁移到 data/accounts/17757541197/..."
    node scripts/migrate-account-data.mjs 17757541197
  else
    mkdir -p data/accounts/17757541197
    echo "[restart-app] 既无老库也无账号库，将由 cloud-api 在首次访问时新建"
  fi
fi

echo "[restart-app] 0.5/4 构建 main-api dist (per-account 子进程依赖)..."
( cd api && pnpm exec nest build )

echo "[restart-app] 1/4 重启 cloud-api (3001)..."
node scripts/dev-services.mjs restart cloud-api
if ! node scripts/wait-for-service-ready.mjs cloud-api http://127.0.0.1:3001/ 60000 1000; then
  tail -n 80 logs/dev-services/cloud-api.err.log || true
  exit 1
fi

echo "[restart-app] 2/4 构建主 App + nginx (5180)..."
node scripts/dev-services.mjs stop app
pnpm --dir apps/app build
node scripts/ensure-local-web-nginx.mjs
node scripts/wait-for-service-ready.mjs web http://127.0.0.1:5180/healthz 30000 1000

# Wiki 与 Admin 走 vite dev (HMR)；失败不阻塞主链路。
echo "[restart-app] 3/4 重启 Wiki 角色管理平台 (5184)..."
if ! node scripts/dev-services.mjs restart wiki; then
  echo "[restart-app] wiki 启动命令失败，继续..."
elif ! node scripts/wait-for-service-ready.mjs wiki http://127.0.0.1:5184/ 30000 1000; then
  tail -n 40 logs/dev-services/wiki.err.log 2>/dev/null || true
  echo "[restart-app] wiki 未就绪，继续..."
fi

echo "[restart-app] 4/4 重启管理后台 (5181)..."
if ! node scripts/dev-services.mjs restart admin; then
  echo "[restart-app] admin 启动命令失败，继续..."
elif ! node scripts/wait-for-service-ready.mjs admin http://127.0.0.1:5181/ 30000 1000; then
  tail -n 40 logs/dev-services/admin.err.log 2>/dev/null || true
  echo "[restart-app] admin 未就绪，继续..."
fi

echo ""
echo "服务地址："
echo "  Cloud API:      http://127.0.0.1:3001  (按手机号 spawn 独立 main-api 子进程)"
echo "  主 App:         http://127.0.0.1:5180"
echo "  Wiki 角色平台:  http://127.0.0.1:5184"
echo "  管理后台:       http://127.0.0.1:5181"
echo ""
echo "提示: 每个手机号的数据隔离在 data/accounts/{phone}/ 下。"
echo "      子进程日志：logs/dev-services/api-{phone}.{out,err}.log"
