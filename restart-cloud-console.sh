#!/bin/bash
# 仅重启云世界控制台 (5182, vite dev)。
#
# "最新代码" 落点: vite dev 重启即重新读取源码。
#
# 公网访问: 无直接公网 URL。cloud-console 走 vite proxy 调 cloud-api (127.0.0.1:3001)。
#
# 透传选项: --skip-account-prep / -h。详见 ./restart-app.sh --help
exec "$(dirname "$0")/restart-app.sh" cloud-console "$@"
