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

# AI 助手：密钥仅由平台环境变量注入；缺失时仅 AI 接口不可用。
# 当前接入阿里云百炼（千问）兼容端点 + DeepSeek 模型；旧变量名 DEEPSEEK_* 仍兼容。
AI_API_KEY = os.environ.get("AI_API_KEY", "") or os.environ.get("DEEPSEEK_API_KEY", "")
AI_BASE_URL = (
    os.environ.get("AI_BASE_URL", "")
    or os.environ.get("DEEPSEEK_BASE_URL", "")
    or "https://dashscope.aliyuncs.com/compatible-mode/v1"
)
AI_MODEL = os.environ.get("AI_MODEL", "") or os.environ.get("DEEPSEEK_MODEL", "") or "deepseek-v3"
AI_TIMEOUT_SECONDS = float(
    os.environ.get("AI_TIMEOUT_SECONDS", "") or os.environ.get("DEEPSEEK_TIMEOUT_SECONDS", "") or "60"
)
AI_MAX_TOKENS = int(os.environ.get("AI_MAX_TOKENS", "1200"))
AI_TEMPERATURE = float(os.environ.get("AI_TEMPERATURE", "0.7"))
# 思考模式：空=按模型自动（V4 默认关闭），可设 true/false。
AI_ENABLE_THINKING = os.environ.get("AI_ENABLE_THINKING", "").strip().lower()

