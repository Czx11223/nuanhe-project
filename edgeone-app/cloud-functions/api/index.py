"""EdgeOne Makers 云函数入口：暖禾家具 API（挂载在 /api）。

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

"""FastAPI 应用入口
功能：创建 app 实例、配置 CORS 与静态文件、注册 13 个业务路由、统一异常处理与响应中间件、
      启动钩子（自动建库+种子）、提供健康检查。
说明：M2 阶段完成鉴权/RBAC/统一响应/各模块 CRUD/上传/限流/Swagger 注解，路由在此统一挂载。
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, UPLOAD_DIR
from app import models  # 关键：导入模型，确保 Base.metadata 注册
from app.init_db import init_and_seed  # 建库 + 种子逻辑
from app.responses import register_exception_handlers, response_wrapper

# 13 个业务路由（含公开读接口与后台管理接口）
from app.routers import (
    about,
    admins,
    auth,
    banners,
    cases,
    messages,
    news,
    product_categories,
    products,
    recruitments,
    roles,
    site_settings,
    upload,
)

# 确保上传目录存在（StaticFiles 挂载的目录必须真实存在）
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时自动建库并填充种子，关闭时无需特殊处理。"""
    init_and_seed()
    yield


# 创建 FastAPI 应用实例
app = FastAPI(
    title="暖禾家具 企业官网后端 API",
    version="1.0.0",
    description=(
        "企业家居网站后端服务（FastAPI + SQLite）。\n\n"
        "阶段：M2 已完成 —— 鉴权(JWT+RBAC) / 统一响应{code,data,msg} / 13 个业务路由"
        "（含前台公开读接口）/ 文件上传 / 富文本 XSS 清洗 / 留言 60s 限流 / 首次登录强制改密。\n\n"
        "接口契约见 Swagger 下方各 Tag；错误码表见「系统」说明与开发技术文档 6.4。"
    ),
    lifespan=lifespan,
)

# CORS 跨域中间件：开发期允许 5173/5174，生产通过 CORS_ORIGINS 配置 Pages 域名。
# 注意：allow_credentials=True 时浏览器不接受通配 "*"，故配 "*" 时自动关闭凭证
#       （本项目鉴权走 Authorization Bearer，不依赖 Cookie，关闭凭证不影响功能）。
_allow_all = "*" in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=not _allow_all,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# 统一响应包装中间件：把业务路由返回的“裸数据” 2xx JSON 包成 {code:0,data,msg}
app.middleware("http")(response_wrapper)

# 统一异常处理器：401/403/404/400/422/429/500 -> {code,msg}
register_exception_handlers(app)

# 安全响应头：禁止内容嗅探（伪装成图片的 HTML 不得被当页面执行）、禁 iframe 嵌套。
@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/static/"):
        resp.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
        )
    return resp


# 精确挂载两个静态子目录，不再把 UPLOAD_DIR 的父目录整体公开
# （旧实现一旦 UPLOAD_DIR 被指到项目外，会连带暴露 .env / app.db / 源码）。
_SEED_DIR = os.path.join(os.path.dirname(UPLOAD_DIR) or "static", "seed")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(_SEED_DIR, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/static/seed", StaticFiles(directory=_SEED_DIR), name="seed")

# ---------------- 注册业务路由 ----------------
app.include_router(auth.router)
app.include_router(admins.router)
app.include_router(roles.router)
app.include_router(banners.router)
app.include_router(site_settings.router)
app.include_router(about.router)
app.include_router(product_categories.router)
app.include_router(products.router)
app.include_router(news.router)
app.include_router(cases.router)
app.include_router(recruitments.router)
app.include_router(messages.router)
app.include_router(upload.router)


@app.get("/", tags=["系统"])
def root():
    """根路径：返回服务基本信息。"""
    return {
        "code": 0,
        "msg": "ok",
        "data": "暖禾家具后端 API，访问 /docs 查看接口文档",
    }


@app.get("/health", tags=["系统"])
def health():
    """健康检查接口：用于验证服务已启动（部署/监控可用）。"""
    return {"code": 0, "msg": "ok", "data": {"service": "暖禾-api", "status": "up"}}
