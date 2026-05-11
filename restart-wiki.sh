#!/bin/bash
# 仅重启 Wiki 角色平台 (5184, vite dev)。
#
# "最新代码" 落点: vite dev 重启即重新读取源码; HMR 之外的脏状态 (依赖图错乱、
# .vite 缓存等) 也会被这次冷启动清掉。
#
# 公网访问: 无直接公网 URL。wiki UI 经 vite proxy 打 cloud-api 的 per-account
# worker (127.0.0.1:3010), 健康探活会穿透代理打一次 /api/wiki/recent-changes,
# 验证整条 wiki → vite proxy → LPP worker 链路是活的。
#
# 透传选项: --skip-account-prep / -h。详见 ./restart-app.sh --help
exec "$(dirname "$0")/restart-app.sh" wiki "$@"
