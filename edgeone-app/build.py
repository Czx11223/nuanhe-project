"""暖禾家具 —— EdgeOne Makers 部署项目生成器（可重复执行）。

用法（在本文件所在目录执行）：
    python build.py                 # 同步后端云函数
    python build.py --frontends     # 同时构建两个前端并合并到 dist/

平台 Python 函数构建器只打包 .py 文件，因此：
  - 种子数据库 / init.sql 内嵌为 app/seed_bundle.py（base64 + 字符串常量）
  - 演示图片放入 dist/static/ 由静态站点直出；仅后台新上传走 /api/static/uploads
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent
CF = ROOT / "cloud-functions"
DIST = ROOT / "dist"

ENTRY_HEAD = '''"""EdgeOne Makers 云函数入口：暖禾家具 API（挂载在 /api）。

平台会把 /api 前缀剥离后再交给本 ASGI 应用，所以内部路由不带 /api。
函数实例无持久磁盘：数据库位于 /tmp/nuanhe，首次启动由 init_db 执行内嵌
init.sql 建表并写入受控种子；冷启动/重新部署后恢复初始数据（演示部署方案）。
管理员口令由 ADMIN_INIT_PASSWORD 环境变量指定；未配置时随机生成并输出到启动日志。
"""
import pathlib
import sys

_CF_ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(_CF_ROOT) not in sys.path:
    sys.path.insert(0, str(_CF_ROOT))

_DATA = pathlib.Path("/tmp/nuanhe")
(_DATA / "static" / "uploads").mkdir(parents=True, exist_ok=True)
(_DATA / "static" / "seed").mkdir(parents=True, exist_ok=True)

'''

CONFIG_PY = '''"""EdgeOne 云函数部署配置（演示模式）。

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

'''

def _cloud_reqs() -> str:
    """依赖单一来源：读取 api/requirements.txt，剔除注释与 uvicorn（平台提供 ASGI runtime）。"""
    lines = []
    for line in (SRC / "api" / "requirements.txt").read_text(encoding="utf-8").splitlines():
        spec = line.split("#", 1)[0].strip()
        if spec and "uvicorn" not in spec.lower():
            lines.append(spec)
    return "\n".join(lines) + "\n"


REQS = _cloud_reqs()

# init_db.py 原本从磁盘读 api/init.sql；部署包里没有该文件，改为读内嵌常量。
INIT_DB_OLD_PATH = '''# init.sql 位于 api/ 目录下（与 app/ 同级）
_INIT_SQL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "init.sql"
)'''
INIT_DB_NEW_PATH = '''# EdgeOne 部署：构建器只打包 .py，DDL 内嵌在 app/seed_bundle.py
from app.seed_bundle import INIT_SQL as _INIT_SQL'''
INIT_DB_OLD_READ = '''        with open(_INIT_SQL_PATH, "r", encoding="utf-8") as f:
            sql_text = f.read()'''
INIT_DB_NEW_READ = '''        sql_text = _INIT_SQL'''

# 部署版：后台新上传的图片落在云函数 /tmp，需带 /api 前缀才能命中函数路由；
# 数据库里已有的演示图仍由静态站点 /static/ 直出。
UPLOAD_OLD = 'f"/static/uploads/{filename}"'
UPLOAD_NEW = 'f"/api/static/uploads/{filename}"'


# 只匹配路由装饰器里的路径首段，避免误伤注释、docstring、URL 常量与 seed_bundle。
_ROUTE_PREFIX_RE = re.compile(
    r'(@(?:router|app)\.(?:get|post|put|patch|delete)\(\s*["\'])/api'
)


def _strip_api_prefix(text: str) -> str:
    """平台剥离 /api 前缀后再交给应用，故仅把路由装饰器中的 /api 去掉。"""
    return _ROUTE_PREFIX_RE.sub(r"\1", text)


def _replace_or_fail(text: str, old: str, new: str, what: str) -> str:
    if old not in text:
        raise RuntimeError(f"适配失败，未找到目标片段：{what}")
    return text.replace(old, new, 1)


def sync_backend() -> None:
    app_src = SRC / "api" / "app"
    app_dst = CF / "app"
    # 覆盖式同步（不做批量删除，避免沙箱的批量删除保护）
    # 先清空生成物：源里删除/改名的模块不得残留在部署包中
    if app_dst.exists():
        shutil.rmtree(app_dst)
    # copytree 会自行创建目标目录，不要提前 mkdir（否则 FileExistsError）
    shutil.copytree(
        app_src, app_dst,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    # main.py 的内容已进入 api/index.py；保留副本会被平台误注册成 /app/main 路由
    (app_dst / "main.py").unlink(missing_ok=True)

    for p in app_dst.rglob("*.py"):
        p.write_text(_strip_api_prefix(p.read_text(encoding="utf-8")), encoding="utf-8")
    (app_dst / "config.py").write_text(CONFIG_PY, encoding="utf-8")

    # 只内嵌 DDL；演示库在云函数首次启动时由 init.sql + seed() 受控生成，
    # 不再把开发者本地的 app.db（含真实密码哈希与业务数据）打包进部署产物。
    init_sql = (SRC / "api" / "init.sql").read_text(encoding="utf-8")
    (app_dst / "seed_bundle.py").write_text(
        '"""内嵌 DDL：构建器只打包 .py，故用字符串常量携带 init.sql。"""\n'
        f"INIT_SQL = {init_sql!r}\n",
        encoding="utf-8",
    )

    init_db = app_dst / "init_db.py"
    t = init_db.read_text(encoding="utf-8")
    t = _replace_or_fail(t, INIT_DB_OLD_PATH, INIT_DB_NEW_PATH, "init_db 路径常量")
    t = _replace_or_fail(t, INIT_DB_OLD_READ, INIT_DB_NEW_READ, "init_db 读取文件")
    init_db.write_text(t, encoding="utf-8")

    upload = app_dst / "routers" / "upload.py"
    t = upload.read_text(encoding="utf-8")
    t = _replace_or_fail(t, UPLOAD_OLD, UPLOAD_NEW, "upload 返回路径")
    upload.write_text(t, encoding="utf-8")

    api_dir = CF / "api"
    api_dir.mkdir(parents=True, exist_ok=True)
    main_text = (SRC / "api" / "app" / "main.py").read_text(encoding="utf-8")
    (api_dir / "index.py").write_text(ENTRY_HEAD + _strip_api_prefix(main_text), encoding="utf-8")

    (CF / "requirements.txt").write_text(REQS, encoding="utf-8")

    # Windows 下 write_text 会写 CRLF；统一规范为 LF，避免每次构建全量翻转干扰评审
    for p in list(app_dst.rglob("*.py")) + list(api_dir.rglob("*.py")):
        p.write_bytes(p.read_bytes().replace(b"\r\n", b"\n"))

    # 演示图片由静态站点直出（不经过云函数）
    if DIST.exists():
        shutil.copytree(SRC / "api" / "static", DIST / "static", dirs_exist_ok=True)
    print("[OK] cloud-functions/ 已生成（种子内嵌），dist/static/ 已同步")


def build_frontends() -> None:
    env_front = os.environ.copy()
    env_front["VITE_API_BASE"] = ""
    env_front["VITE_STATIC_BASE"] = "/api"
    subprocess.run("npm run build", cwd=str(SRC / "frontend"), env=env_front, shell=True, check=True)

    env_admin = os.environ.copy()
    env_admin["VITE_API_BASE"] = ""
    env_admin["VITE_STATIC_BASE"] = "/api"
    env_admin["VITE_BASE_PATH"] = "/admin"
    subprocess.run(
        "npm run build -- --base=/admin/",
        cwd=str(SRC / "backend"),
        env=env_admin,
        shell=True,
        check=True,
    )

    # 两个前端都构建成功后才清理旧产物。此前用 dirs_exist_ok 合并且从不清空，
    # 导致每次构建遗留一份带旧 hash 的 bundle（dist/admin/assets 曾累积 4 个 1.6MB 包）。
    # dist/ 完全是生成物（官网 + 后台 + api/static 演示图），可以整体重建。
    # 放在 npm build 之后，构建失败时不会删除上一版可用产物。
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SRC / "frontend" / "dist", DIST, dirs_exist_ok=True)
    shutil.copytree(SRC / "backend" / "dist", DIST / "admin", dirs_exist_ok=True)
    shutil.copytree(SRC / "api" / "static", DIST / "static", dirs_exist_ok=True)
    print("[OK] dist/ 已生成：官网 / + 后台 /admin + 演示图片 /static")


if __name__ == "__main__":
    sync_backend()
    if "--frontends" in sys.argv:
        build_frontends()
    else:
        # 不重跑前端构建时也要保证静态图片存在
        if DIST.exists():
            shutil.copytree(SRC / "api" / "static", DIST / "static", dirs_exist_ok=True)
