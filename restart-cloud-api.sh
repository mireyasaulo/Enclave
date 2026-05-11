#!/bin/bash
# 仅重启 cloud-api (3001)。
#
# "最新代码" 落点:
#   - apps/cloud-api: dev-services.mjs prestart 强制 nest build (即使加了 --no-build)。
#   - api/dist: 由本脚本里 main-api-build 跑 nest build (因为 per-account worker
#     由 cloud-api 在 3010+ spawn, 用的是 api/dist)。--no-build 会跳过这步,
#     此时 worker 跑的是上次的产物, 想要绝对最新就别加 --no-build。
#
# 公网访问: cloud-api 是后端, 无直接公网 URL; 浏览器侧通过 admin/app/wiki 的
# /api vite proxy 间接打过来, 重启后下一笔请求就是新代码。
#
# 透传选项: --no-build / --skip-account-prep / -h。详见 ./restart-app.sh --help
exec "$(dirname "$0")/restart-app.sh" cloud-api "$@"
