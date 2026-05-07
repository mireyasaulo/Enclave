#!/bin/bash
# 并行重启脚本：可选指定服务、可选跳过构建。
# 默认：cloud-api / app / wiki / admin / cloud-console / site 全部并行重启。
set -uo pipefail

cd "$(dirname "$0")"

export CLOUD_LOCAL_PROCESS_PROVIDER="${CLOUD_LOCAL_PROCESS_PROVIDER:-1}"

# ---------- 参数解析 ----------
DO_BUILD=1
SKIP_ACCOUNT_PREP=0
SERVICES=()

usage() {
  cat <<EOF
用法: $(basename "$0") [选项] [服务名...]

可选服务 (不传则全部并行重启):
  cloud-api  app  wiki  admin  cloud-console  site

选项:
  --no-build           跳过 main-api 与 app 的构建（仅重启服务进程）
  --skip-account-prep  跳过账号目录初始化检查
  -h, --help           显示此帮助

示例:
  $(basename "$0")                      # 全部并行重启
  $(basename "$0") wiki admin           # 只重启 wiki 与 admin
  $(basename "$0") --no-build cloud-api # 仅重启 cloud-api，跳过预构建
  $(basename "$0") cloud-console        # 只重启云世界控制台
  $(basename "$0") site                 # 只重启官网（apps/site, 5185）
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --no-build) DO_BUILD=0; shift ;;
    --skip-account-prep) SKIP_ACCOUNT_PREP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "未知参数: $1" >&2; usage; exit 2 ;;
    cloud-api|app|wiki|admin|cloud-console|site) SERVICES+=("$1"); shift ;;
    *) echo "未知服务: $1" >&2; usage; exit 2 ;;
  esac
done

if (( ${#SERVICES[@]} == 0 )); then
  SERVICES=(cloud-api app wiki admin cloud-console site)
fi

want() {
  local t="$1" s
  for s in "${SERVICES[@]}"; do [[ "$s" == "$t" ]] && return 0; done
  return 1
}

# ---------- 0. 账号数据准备 ----------
if (( SKIP_ACCOUNT_PREP == 0 )); then
  if [ ! -f data/accounts/17757541197/database.sqlite ]; then
    if [ -f data/database.sqlite ]; then
      echo "[restart-app] 迁移老 data/database.sqlite -> data/accounts/17757541197/..."
      node scripts/migrate-account-data.mjs 17757541197
    else
      mkdir -p data/accounts/17757541197
    fi
  fi
fi

# ---------- 并行任务调度 ----------
LOG_DIR="logs/restart-app"
mkdir -p "$LOG_DIR"
TS=$(date +%Y%m%d-%H%M%S)
START_TIME=$SECONDS

JOB_NAMES=()
declare -A JOB_PID JOB_LOG JOB_CRITICAL

launch() {
  # launch <name> <critical:0|1> <cmd...>
  local name="$1" critical="$2"; shift 2
  local log="$LOG_DIR/${name}.${TS}.log"
  ( "$@" ) >"$log" 2>&1 &
  local pid=$!
  JOB_NAMES+=("$name")
  JOB_PID[$name]=$pid
  JOB_LOG[$name]=$log
  JOB_CRITICAL[$name]=$critical
  echo "[restart-app] ▶ $name (pid=$pid)"
}

# ---------- 任务定义 ----------
build_main_api() {
  cd api && pnpm exec nest build
}

restart_cloud_api() {
  node scripts/dev-services.mjs restart cloud-api
  node scripts/wait-for-service-ready.mjs cloud-api http://127.0.0.1:3001/ 60000 1000
}

restart_app_full() {
  node scripts/dev-services.mjs stop app
  pnpm --dir apps/app build
  node scripts/ensure-local-web-nginx.mjs
  node scripts/wait-for-service-ready.mjs web http://127.0.0.1:5180/healthz 30000 1000
}

restart_app_nobuild() {
  node scripts/ensure-local-web-nginx.mjs
  node scripts/wait-for-service-ready.mjs web http://127.0.0.1:5180/healthz 30000 1000
}

restart_wiki() {
  node scripts/dev-services.mjs restart wiki
  node scripts/wait-for-service-ready.mjs wiki http://127.0.0.1:5184/ 30000 1000
}

restart_admin() {
  node scripts/dev-services.mjs restart admin
  node scripts/wait-for-service-ready.mjs admin http://127.0.0.1:5181/ 30000 1000
}

restart_cloud_console() {
  node scripts/dev-services.mjs restart cloud-console
  node scripts/wait-for-service-ready.mjs cloud-console http://127.0.0.1:5182/ 30000 1000
}

restart_site() {
  # apps/site 用 next dev 跑，但如果之前误跑过 next build / pnpm --dir apps/site build，
  # .next 里会残留 standalone / BUILD_ID / prerender-manifest 等构建产物，与 dev 运行时
  # 写入的 server/chunks 文件结构冲突，导致 webpack-runtime 找不到 chunk（症状：访问任意
  # locale 路由 500，日志报 Cannot find module './933.js' 之类）。检测到污染就清掉。
  if [ -d apps/site/.next/standalone ] \
     || [ -f apps/site/.next/BUILD_ID ] \
     || [ -f apps/site/.next/prerender-manifest.json ]; then
    echo "[restart-app] apps/site/.next 含 build 产物残留，清理后重新启动 next dev"
    rm -rf apps/site/.next
  fi
  node scripts/dev-services.mjs restart site
  node scripts/wait-for-service-ready.mjs site http://127.0.0.1:5185/ 60000 1000
}

# ---------- 启动并行任务 ----------
# main-api 构建仅在需要 cloud-api 且未禁用构建时执行
# (per-account 子进程依赖 api/dist)
if want cloud-api && (( DO_BUILD == 1 )); then
  launch main-api-build 1 build_main_api
fi

if want cloud-api; then
  launch cloud-api 1 restart_cloud_api
fi

if want app; then
  if (( DO_BUILD == 1 )); then
    launch app 1 restart_app_full
  else
    launch app 1 restart_app_nobuild
  fi
fi

# wiki / admin / cloud-console / site 是 vite/next dev，失败不阻塞主链路
if want wiki;          then launch wiki          0 restart_wiki;          fi
if want admin;         then launch admin         0 restart_admin;         fi
if want cloud-console; then launch cloud-console 0 restart_cloud_console; fi
if want site;          then launch site          0 restart_site;          fi

# ---------- 等待并汇总结果 ----------
FAILED=0
for name in "${JOB_NAMES[@]}"; do
  pid=${JOB_PID[$name]}
  if wait "$pid"; then
    echo "[restart-app] ✓ $name"
  else
    if [[ "${JOB_CRITICAL[$name]}" == "1" ]]; then
      echo "[restart-app] ✗ $name (关键步骤失败)"
      tail -n 40 "${JOB_LOG[$name]}" || true
      FAILED=1
    else
      echo "[restart-app] ⚠ $name 未就绪，跳过 (见 ${JOB_LOG[$name]})"
      tail -n 20 "${JOB_LOG[$name]}" || true
    fi
  fi
done

ELAPSED=$(( SECONDS - START_TIME ))

if (( FAILED != 0 )); then
  echo ""
  echo "[restart-app] ❌ 关键步骤失败，用时 ${ELAPSED}s"
  exit 1
fi

echo ""
echo "[restart-app] ✅ 完成 (用时 ${ELAPSED}s)"
echo ""
echo "服务地址："
want cloud-api     && echo "  Cloud API:      http://127.0.0.1:3001  (按手机号 spawn 独立 main-api 子进程)"
want app           && echo "  主 App:         http://127.0.0.1:5180"
want wiki          && echo "  Wiki 角色平台:  http://127.0.0.1:5184"
want admin         && echo "  管理后台:       http://127.0.0.1:5181"
want cloud-console && echo "  云世界控制台:   http://127.0.0.1:5182"
want site          && echo "  官网:           http://127.0.0.1:5185  (vicp.fun 1gw06751dd053 隧道指向此服务)"
echo ""
echo "日志: $LOG_DIR/*.${TS}.log    每账号子进程: logs/dev-services/api-{phone}.{out,err}.log"
