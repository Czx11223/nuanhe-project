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

# CORS 跨域中间件：允许前台(5173)与后台(5174)访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 统一响应包装中间件：把业务路由返回的“裸数据” 2xx JSON 包成 {code:0,data,msg}
app.middleware("http")(response_wrapper)

# 统一异常处理器：401/403/404/400/422/429/500 -> {code,msg}
register_exception_handlers(app)

# 挂载静态文件目录：/static 对外服务整个 static/（含 uploads 上传目录与 seed 演示占位图）。
# 说明：UPLOAD_DIR=static/uploads 仅保证上传目录存在；此处挂载其父目录 static/，
#       使 /static/uploads/xxx 与 /static/seed/xxx 均可直接访问。
_STATIC_DIR = os.path.dirname(UPLOAD_DIR) or "static"
os.makedirs(_STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

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


@app.get("/api/health", tags=["系统"])
def health():
    """健康检查接口：用于验证服务已启动（部署/监控可用）。"""
    return {"code": 0, "msg": "ok", "data": {"service": "暖禾-api", "status": "up"}}
