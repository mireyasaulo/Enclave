#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[restart-app] 1/4 重启后端 API (3000)..."
node scripts/dev-services.mjs restart api
if ! node scripts/wait-for-service-ready.mjs api http://127.0.0.1:3000/health 60000 1000; then
  tail -n 80 logs/dev-services/api.err.log || true
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
echo "  后端 API:       http://127.0.0.1:3000"
echo "  主 App:         http://127.0.0.1:5180"
echo "  Wiki 角色平台:  http://127.0.0.1:5184"
echo "  管理后台:       http://127.0.0.1:5181"
