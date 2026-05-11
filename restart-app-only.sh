#!/bin/bash
# 仅重启主 App 前端 (5180)。脚本名加 -only 是为了和编排脚本 restart-app.sh 区分。
#
# "最新代码" 落点:
#   - apps/app: pnpm --dir apps/app build → apps/app/dist
#   - nginx (端口 5180): ensure-local-web-nginx.mjs 用最新 dist 重载配置
#
# 公网访问: 公网 HTTP 隧道 http://1gw06751dd053.vicp.fun:29490 → 127.0.0.1:5180
# 走的也是这个 nginx, 所以本地 5180 一更新, 公网 :29490 立即同步。
# (公网 HTTPS https://1gw06751dd053.vicp.fun/ 是另一个隧道指 site, 跟本脚本无关。)
#
# 透传选项: --no-build (跳过 vite build, 只重载 nginx; 此时 dist 是上次的)
exec "$(dirname "$0")/restart-app.sh" app "$@"
