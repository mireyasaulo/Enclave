#!/usr/bin/env bash
# 重新打包 apps/app 的静态产物 (apps/app/dist/)，nginx 5180 立即换新 bundle。
# 默认只跑 vite build (build:fast)；加 --full 跑 tsc 类型检查 + vite build。
# 加 --no-extract 跳过 lingui 文案抽取（无新增 msg 时可用）。
set -uo pipefail

cd "$(dirname "$0")"

DO_EXTRACT=1
MODE="fast"  # fast | full

while (( $# > 0 )); do
  case "$1" in
    --no-extract) DO_EXTRACT=0; shift ;;
    --full)       MODE="full"; shift ;;
    --fast)       MODE="fast"; shift ;;
    -h|--help)
      cat <<EOF
用法: $(basename "$0") [选项]

选项:
  --fast        只跑 vite build (默认，~6s)
  --full        先跑 tsc 类型检查再 vite build (~30s)
  --no-extract  跳过 lingui i18n:extract（没新增 msg\`...\` 时可用）
  -h, --help    显示此帮助
EOF
      exit 0
      ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

START=$SECONDS

if (( DO_EXTRACT == 1 )); then
  echo "[rebuild-app] ▶ 抽取 lingui 文案 (i18n:extract)"
  pnpm i18n:extract
fi

echo "[rebuild-app] ▶ 构建 apps/app (mode=$MODE)"
if [[ "$MODE" == "full" ]]; then
  pnpm --filter @yinjie/app build
else
  pnpm --filter @yinjie/app build:fast
fi

echo "[rebuild-app] ▶ 确保 nginx 服务在线 (5180)"
node scripts/ensure-local-web-nginx.mjs >/dev/null
node scripts/wait-for-service-ready.mjs web http://127.0.0.1:5180/healthz 15000 500 || {
  echo "[rebuild-app] ⚠ nginx 健康检查未通过，请手动检查 logs/dev-services/web.*.log"
  exit 1
}

ELAPSED=$(( SECONDS - START ))
echo ""
echo "[rebuild-app] ✅ 完成 (用时 ${ELAPSED}s)"
echo "  浏览器强制刷新一下 (Ctrl+Shift+R) 即可看到新 bundle"
echo "  访问: http://127.0.0.1:5180/"
