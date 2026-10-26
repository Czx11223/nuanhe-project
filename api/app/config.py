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
JWT_SECRET = _get("JWT_SECRET", "change_me_in_prod")   # 生产务必替换
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
        "http://127.0.0.1:5173,http://127.0.0.1:5174",
    ).split(",") if o.strip()
]
