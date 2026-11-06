#!/usr/bin/env bash
# 本地构建两个前端生产包（注入后端 API 地址）
# 用法：bash deploy/scripts/build.sh https://xxxx.cn-hangzhou.fcapp.run
# 说明：EdgeOne Pages 上构建时改用控制台环境变量 VITE_API_BASE，无需跑本脚本；
#       本脚本用于「本地上传 dist」的部署方式，或上线前本地预检。
set -euo pipefail

API_BASE="${1:-}"
if [ -z "$API_BASE" ]; then
  echo "用法: bash deploy/scripts/build.sh https://<你的函数名>-<随机串>.<地域>.fcapp.run"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# 优先用项目自带的 node，其次用 PATH 里的 node
NODE_BIN="${NODE_BIN:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  NODE_BIN="C:/Users/20454/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"
fi

echo "==> 后端 API: $API_BASE"

echo "==> 构建官网前台 frontend"
cd "$ROOT/frontend"
VITE_API_BASE="$API_BASE" "$NODE_BIN" node_modules/vite/bin/vite.js build

echo "==> 类型检查 + 构建后台管理 backend"
cd "$ROOT/backend"
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit
VITE_API_BASE="$API_BASE" "$NODE_BIN" node_modules/vite/bin/vite.js build

echo
echo "==> 校验产物中已写入 API 地址"
grep -l "$API_BASE" "$ROOT/frontend/dist/assets/"*.js "$ROOT/backend/dist/assets/"*.js >/dev/null \
  && echo "OK: frontend/dist 与 backend/dist 均已注入 $API_BASE" \
  || { echo "失败: 产物中未找到 API 地址，请检查环境变量是否生效"; exit 1; }

echo "==> 完成"
echo "  前台产物: $ROOT/frontend/dist"
echo "  后台产物: $ROOT/backend/dist"
