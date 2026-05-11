#!/bin/bash
# 仅重启管理后台 (5181, vite dev)。
#
# "最新代码" 落点: vite dev 重启即重新读取源码。
#
# 公网访问: 无直接公网 URL。admin UI 经 vite proxy 打 main-api (127.0.0.1:3000),
# 健康探活会穿透代理 GET /api/admin/stats 并校验 content-type 是 JSON,
# 提前发现 vite proxy 配置丢失或 main-api 未起来。
#
# 透传选项: --skip-account-prep / -h。详见 ./restart-app.sh --help
exec "$(dirname "$0")/restart-app.sh" admin "$@"
