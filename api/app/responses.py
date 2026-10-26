"""统一响应与异常处理器（M2：响应契约 {code,data,msg}）
功能：
  1. success / fail / paginate：在路由中快速构造统一结构的 dict。
  2. response_wrapper：ASGI 中间件，把业务路由返回的“裸数据” 2xx JSON
     自动包成 {code:0, data, msg:"ok"}，保证全站响应契约一致。
  3. register_exception_handlers：把 HTTPException / 校验错误 / 未捕获异常
     统一转换为 {code,msg}（非零 code 表示失败），详见 开发技术文档 6.4 错误码表。

契约约定（引 技术文档 4.3 / 6.4）：
  成功：{"code":0, "data":<任意>, "msg":"ok"}
  失败：{"code":<非零>, "msg":"<错误描述>"}
  分页：{"code":0, "data":{"list":[...], "total":N, "page":p, "page_size":s}, "msg":"ok"}
"""
import json
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import StreamingResponse


# ----------------------------------------------------------------------------
# 一、响应构造助手（路由里直接调用，返回 dict；也可被中间件二次兜底）
# ----------------------------------------------------------------------------

def success(data: Any = None, msg: str = "ok") -> dict:
    """构造成功响应体：{code:0, data, msg}。"""
    return {"code": 0, "data": data, "msg": msg}


def fail(code: int, msg: str, data: Any = None) -> dict:
    """构造失败响应体：{code, msg, data?}。"""
    return {"code": code, "msg": msg, "data": data}


def paginate(items: Any, total: int, page: int, page_size: int) -> dict:
    """构造分页响应体：把列表与分页元信息打包到 data 中。

    page 归一兜底为至少 1（对齐测试报告 BUG-010 修复约定：page<=0 时按第 1 页
    处理而非报错；路由层 offset 同步用 max(1, page) 保证查询一致）。
    """
    return success({
        "list": items,
        "total": total,
        "page": max(1, page),
        "page_size": page_size,
    })


# ----------------------------------------------------------------------------
# 二、响应包装中间件
# ----------------------------------------------------------------------------

async def response_wrapper(request: Request, call_next):
    """把业务路由返回的 2xx JSON 包成统一结构。

    规则：
      - 仅对 JSONResponse 做包装；StreamingResponse/FileResponse（静态文件等）直接透传。
      - 若响应体已含 "code" 键（如异常处理器/fail 已构造），不再包装，避免重复。
      - 否则用 success() 包装原 body 作为 data，并保持原 HTTP 状态码。
    """
    resp = await call_next(request)

    # 仅 JSON 响应需要包装；静态文件(StreamingResponse)等无 .body 属性，直接放行
    if not isinstance(resp, JSONResponse):
        return resp

    try:
        body = json.loads(resp.body)
    except (json.JSONDecodeError, TypeError):
        return resp

    # 已是统一结构（异常处理器 / 显式 fail）则跳过
    if isinstance(body, dict) and "code" in body:
        return resp

    wrapped = JSONResponse(
        content=success(body),
        status_code=resp.status_code,
    )
    # 透传 set-cookie 等必要头（CORS 由底层中间件处理）
    if "set-cookie" in resp.headers:
        wrapped.headers["set-cookie"] = resp.headers["set-cookie"]
    return wrapped


# ----------------------------------------------------------------------------
# 三、异常处理器
# ----------------------------------------------------------------------------

def _http_code_to_biz(code: int) -> int:
    """将 HTTP 状态码映射为业务 code（保持数值一致即可）。"""
    return code


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """统一处理 HTTPException：401/403/404/400/429 等 -> {code,msg}。"""
    biz_code = _http_code_to_biz(exc.status_code)
    # 401 与 403 在错误码表中单独约定（引 技术文档 6.4）
    return JSONResponse(
        status_code=exc.status_code,
        content=fail(biz_code, str(exc.detail)),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求参数校验失败（Pydantic）：返回 422 + 字段级错误信息。"""
    # 提取首条错误信息，便于前端提示；同时保留完整 errors 供调试
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = ".".join(str(p) for p in first.get("loc", []))
    msg = f"{loc}: {first.get('msg', '参数校验失败')}" if loc else "参数校验失败"
    return JSONResponse(
        status_code=422,
        content=fail(422, msg, data={"errors": errors}),
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    """兜底：未捕获异常 -> 500，避免泄露堆栈，统一返回 {code:500,msg}。"""
    # 生产环境可在此记录日志；演示阶段直接返回通用错误
    return JSONResponse(
        status_code=500,
        content=fail(500, "服务器内部错误，请稍后重试"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """在 FastAPI 实例上注册上述异常处理器。"""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
