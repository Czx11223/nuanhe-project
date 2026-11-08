"""官网与后台 AI 助手（SSE 流式接口，上游为大模型兼容接口）。"""
import json
import logging
import threading
import time
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.config import AI_API_KEY
from app.models import AdminUser
from app.schemas import AIChatRequest
from app.security import get_current_user
from app.services import deepseek

router = APIRouter(tags=["AI 助手"])
logger = logging.getLogger(__name__)

PUBLIC_PROMPT = """你是暖禾家具官网的 AI 客服助手。请用简洁、友好、专业的简体中文回答。
你可以提供家具选购思路、材质与空间搭配知识、品牌参观与咨询指引。
不要编造实时库存、具体价格、折扣、物流时效或售后承诺；涉及这些信息时，引导用户通过官网联系方式进一步确认。
不要回答与家具、家居和暖禾品牌无关的敏感或危险请求，不要索要密码、支付信息或其他隐私。"""

ADMIN_PROMPT = """你是暖禾家具后台管理系统的 AI 工作助手，服务对象是已登录管理员。
你可以分步骤说明产品、分类、新闻、案例、招聘、留言等后台功能的使用方法，也可以生成或润色产品卖点、详情描述与 SEO 文案。
内容创作默认输出可直接复制的中文文案，结构清晰，不虚构认证、销量、材质参数或企业事实。
你不能直接执行新增、修改、删除、查询数据库等操作，也不要声称已经执行。不要要求或输出管理员密码、JWT、API Key。"""

_RATE_LOCK = threading.Lock()
_RATE_RECORDS: dict[str, list[float]] = {}
_RATE_WINDOW = 60
_RATE_MAX_KEYS = 10000


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(key: str, limit: int) -> None:
    now = time.monotonic()
    with _RATE_LOCK:
        if len(_RATE_RECORDS) > _RATE_MAX_KEYS:
            for item_key, timestamps in list(_RATE_RECORDS.items()):
                if not timestamps or now - timestamps[-1] >= _RATE_WINDOW:
                    del _RATE_RECORDS[item_key]
        recent = [ts for ts in _RATE_RECORDS.get(key, []) if now - ts < _RATE_WINDOW]
        if len(recent) >= limit:
            raise HTTPException(status_code=429, detail="提问过于频繁，请稍后再试")
        recent.append(now)
        _RATE_RECORDS[key] = recent


def public_ai_rate_limit(request: Request) -> None:
    _check_rate_limit(f"public:{_client_ip(request)}", limit=5)


def admin_ai_rate_limit(
    request: Request, current: AdminUser = Depends(get_current_user)
) -> AdminUser:
    _check_rate_limit(f"admin:{current.id}", limit=20)
    return current


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def _streaming_response(
    request: Request, body: AIChatRequest, prompt: str, channel: str
) -> StreamingResponse:
    if not AI_API_KEY:
        raise HTTPException(status_code=503, detail="AI 助手尚未配置，请联系管理员")

    request_id = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex
    messages = [item.model_dump() for item in body.messages]

    async def events() -> AsyncGenerator[str, None]:
        outcome = "done"
        logger.info(json.dumps({
            "event": "ai_chat_start", "request_id": request_id, "channel": channel
        }))
        try:
            async for content in deepseek.stream_chat(messages, prompt):
                if await request.is_disconnected():
                    outcome = "cancelled"
                    return
                yield _sse({"type": "delta", "content": content})
            yield _sse({"type": "done"})
        except deepseek.AIServiceError as exc:
            outcome = "upstream_error"
            yield _sse({"type": "error", "message": str(exc)})
        except Exception:
            outcome = "internal_error"
            logger.exception(json.dumps({
                "event": "ai_chat_error", "request_id": request_id, "channel": channel
            }))
            yield _sse({"type": "error", "message": "AI 服务异常，请稍后重试"})
        finally:
            logger.info(json.dumps({
                "event": "ai_chat_end", "request_id": request_id,
                "channel": channel, "outcome": outcome
            }))

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Request-ID": request_id,
        },
    )


@router.post(
    "/api/ai/chat",
    summary="官网 AI 客服（SSE）",
    dependencies=[Depends(public_ai_rate_limit)],
)
def public_ai_chat(body: AIChatRequest, request: Request) -> StreamingResponse:
    return _streaming_response(request, body, PUBLIC_PROMPT, "public")


@router.post("/api/admin/ai/chat", summary="后台 AI 工作助手（SSE）")
def admin_ai_chat(
    body: AIChatRequest,
    request: Request,
    _: AdminUser = Depends(admin_ai_rate_limit),
) -> StreamingResponse:
    return _streaming_response(request, body, ADMIN_PROMPT, "admin")
