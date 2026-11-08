"""后端配置模块
功能：集中读取运行参数（数据库路径、JWT 密钥/有效期、上传目录、CORS 跨域来源）。
优先级：环境变量 > .env 文件 > 默认值。这样本地可零配置启动，生产可通过环境变量覆盖。
"""
import os

# 项目根目录（api/ 的上一级即 workspace/api 的上一级？此处 __file__ 在 api/app/config.py，
# 往上两级为 workspace 根，但数据库应放在 api/ 内，故用 api 目录作为 BASE_DIR）。
# 说明：os.path.dirname(__file__) = api/app；再 dirname 一次 = api。
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_dotenv(path: str = ".env") -> dict:
    """极简 .env 读取器（不引入额外依赖，保持 requirements.txt 与开发技术文档一致）。

    逐行解析 `KEY=VALUE`，忽略注释(#)与空行，去掉值两端的引号。
    """
    env: dict = {}
    # config.py 运行时 cwd 为 api/，故 .env 默认在 api/.env
    full = os.path.join(_BASE_DIR, path)
    if os.path.exists(full):
        with open(full, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                # 防御：去掉值后面的内联注释（首个未加引号的 # 之后内容）
                if "#" in val:
                    val = val.split("#", 1)[0]
                env[key.strip()] = val.strip().strip('"').strip("'")
    return env


_ENV = _load_dotenv()


def _get(key: str, default: str) -> str:
    """取值顺序：系统环境变量优先，其次 .env，最后默认值。"""
    return os.environ.get(key, _ENV.get(key, default))


# ---------- 数据库 ----------
# SQLite 文件路径：默认置于 api/app.db（零运维）。可通过 DB_PATH 环境变量覆盖。
DB_PATH = _get("DB_PATH", os.path.join(_BASE_DIR, "app.db"))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# ---------- JWT ----------
# JWT 签名密钥必须由运行环境提供；缺失或仍为示例值时拒绝启动，避免可被伪造的令牌。
# 生成：python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET = _get("JWT_SECRET", "")
if not JWT_SECRET or JWT_SECRET in {"change_me_in_prod", "changeme", "secret"}:
    raise RuntimeError(
        "JWT_SECRET 未配置或仍为示例值：请在 api/.env 或环境变量中设置高熵密钥"
        '（python -c "import secrets; print(secrets.token_urlsafe(48))"）'
    )
JWT_ALGORITHM = "HS256"                                # HS256 对称签名
JWT_EXPIRE_MINUTES = int(_get("JWT_EXPIRE_MINUTES", "120"))

# ---------- 上传目录 ----------
# 默认 api/static/uploads；StaticFiles 将在该目录挂载到 /static。
UPLOAD_DIR = _get("UPLOAD_DIR", os.path.join(_BASE_DIR, "static", "uploads"))

# ---------- CORS ----------
# 允许跨域的前端来源：前台 5173 / 后台 5174（逗号分隔）。
CORS_ORIGINS = [
    o.strip() for o in _get(
        "CORS_ORIGINS",
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173,http://127.0.0.1:5174",
    ).split(",") if o.strip()
]

# ---------- AI 助手（OpenAI 兼容接口）----------
# 当前接入：阿里云百炼（千问 AI 平台）的 OpenAI 兼容端点 + DeepSeek 模型。
# API Key 只允许在服务端配置；未配置时 AI 接口返回 503，不影响其他业务启动。
# 兼容旧变量名 DEEPSEEK_*：未配置 AI_* 时自动回退，便于已有部署平滑迁移。
AI_API_KEY = _get("AI_API_KEY", "") or _get("DEEPSEEK_API_KEY", "") or _get("DASHSCOPE_API_KEY", "")
AI_BASE_URL = (
    _get("AI_BASE_URL", "")
    or _get("DEEPSEEK_BASE_URL", "")
    or "https://dashscope.aliyuncs.com/compatible-mode/v1"
)
# 百炼模型广场的 DeepSeek 模型 ID（2026-10 在售：deepseek-v4-pro / deepseek-v4-flash-0731 /
# deepseek-v4.1-flash）；具体可用 ID 以控制台「模型广场」为准。
AI_MODEL = _get("AI_MODEL", "") or _get("DEEPSEEK_MODEL", "") or "deepseek-v4-pro"
AI_TIMEOUT_SECONDS = float(
    _get("AI_TIMEOUT_SECONDS", "") or _get("DEEPSEEK_TIMEOUT_SECONDS", "") or "60"
)
AI_MAX_TOKENS = int(_get("AI_MAX_TOKENS", "1200"))
# 推理类模型（如 deepseek-r1）不支持 temperature，<=0 表示不下发该参数。
AI_TEMPERATURE = float(_get("AI_TEMPERATURE", "0.7"))
# 思考模式开关：空=按模型自动（V4 系列默认关闭思考），true/false=强制指定。
AI_ENABLE_THINKING = _get("AI_ENABLE_THINKING", "").strip().lower()
