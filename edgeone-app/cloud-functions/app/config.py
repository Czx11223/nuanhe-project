"""EdgeOne 云函数部署配置（演示模式）。

数据位于 /tmp/nuanhe：实例存活期间可读写，冷启动后由入口脚本从种子恢复。
本地开发请使用 api/app/config.py，本文件只用于部署产物。
"""
import os

DB_PATH = "/tmp/nuanhe/app.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# 密钥必须由平台环境变量注入，缺失即启动失败（严禁硬编码）。
# 部署前在 EdgeOne 控制台配置 JWT_SECRET，生成方式见 docs/deployment.md。
JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET 未配置：请在 EdgeOne 控制台环境变量中设置高熵密钥")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "120"))

UPLOAD_DIR = "/tmp/nuanhe/static/uploads"
# 同源部署无需跨域；确需跨域时用 CORS_ORIGINS 注入逗号分隔的域名白名单。
_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _origins.split(",") if o.strip()]

