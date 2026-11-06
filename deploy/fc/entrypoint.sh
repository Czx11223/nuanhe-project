#!/bin/sh
# FC 容器启动脚本
# 职责：
#   1. 准备 NAS 数据目录（首次启动把镜像内的种子库与演示图片拷过去）
#   2. 导出运行期路径环境变量（DB_PATH / UPLOAD_DIR 均指向 NAS）
#   3. 以 0.0.0.0:9000 启动 uvicorn（FC 要求监听该端口，且需长连接）
set -e

CODE_DIR="${CODE_DIR:-/code}"          # 镜像内代码目录
DATA_DIR="${DATA_DIR:-/mnt/nas/nuanhe}" # NAS 挂载点下的数据目录

mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/seed"

# 首次启动：数据库不存在才拷贝，避免覆盖线上已修改的数据
if [ ! -f "$DATA_DIR/app.db" ]; then
  echo "[init] seed database -> $DATA_DIR/app.db"
  cp "$CODE_DIR/seed/app.db" "$DATA_DIR/app.db"
else
  echo "[init] database exists, keep it: $DATA_DIR/app.db"
fi

# 演示图片按文件补齐（-n 不覆盖已有文件，保证后台替换过的图不被还原）
cp -rn "$CODE_DIR/static/seed/." "$DATA_DIR/seed/" 2>/dev/null || true
cp -rn "$CODE_DIR/static/uploads/." "$DATA_DIR/uploads/" 2>/dev/null || true

# NAS 以 root 挂载时可写；非 root 运行场景下尽量放开权限（失败不阻断启动）
chmod -R 777 "$DATA_DIR" 2>/dev/null || true

export DB_PATH="${DB_PATH:-$DATA_DIR/app.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-$DATA_DIR/uploads}"
export PORT="${PORT:-9000}"

echo "[start] DB_PATH=$DB_PATH UPLOAD_DIR=$UPLOAD_DIR PORT=$PORT"

# --timeout-keep-alive 900：满足 FC 对长连接（15 分钟以上）的要求
# --workers 1：SQLite 单写者，单进程最稳（配合 FC 实例数上限 1）
cd "$CODE_DIR"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --timeout-keep-alive 900 \
  --workers 1
