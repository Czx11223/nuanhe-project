# 暖禾家具 API —— 阿里云函数计算 FC 自定义容器镜像
# 构建（在项目根目录执行）：
#   docker build --platform linux/amd64 -f deploy/fc/Dockerfile -t nuanhe-api:v1 .
# 说明：
#   - FC 自定义容器只支持 amd64，Apple 芯片机器务必带 --platform linux/amd64
#   - 必须监听 0.0.0.0:9000（FC 的 CAPort 默认 9000）
#   - 数据（SQLite + 上传图片）落在 NAS 挂载点 /mnt/nas/nuanhe，容器本身无状态

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai \
    DATA_DIR=/mnt/nas/nuanhe

WORKDIR /code

# 依赖层单独缓存：先装依赖再拷代码，改代码不会重装依赖
COPY api/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ \
        --trusted-host mirrors.aliyun.com -r /code/requirements.txt

# 业务代码（含 app/、static/seed/、static/uploads/ 演示素材）
COPY api/ /code/

# 首次启动用的种子数据库（拷到 NAS 后由应用自行读写）
COPY api/app.db /code/seed/app.db

COPY deploy/fc/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
