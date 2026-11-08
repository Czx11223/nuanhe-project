"""OpenAI 兼容的流式对话客户端。

当前对接阿里云百炼（千问 AI 平台）兼容端点 + DeepSeek 模型，也可指向任何
OpenAI 兼容服务（官方 DeepSeek、vLLM 等）。仅服务端持有 API Key；
上游 SSE 被解析为纯文本增量，路由层再转换为站内事件格式。
"""
import json
import logging
from typing import AsyncGenerator, Optional

import httpx

from app.config import (
    AI_API_KEY,
    AI_BASE_URL,
    AI_ENABLE_THINKING,
    AI_MAX_TOKENS,
    AI_MODEL,
    AI_TEMPERATURE,
    AI_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)

_CHAT_SUFFIX = "/chat/completions"


class AIServiceError(Exception):
    """可安全展示给终端用户的上游服务异常。"""


# 兼容旧名称，避免既有调用方与测试因重命名失败。
DeepSeekServiceError = AIServiceError


def chat_endpoint(base_url: str) -> str:
    """把配置的 Base URL 规范化为完整的 chat/completions 地址。

    允许三种写法：
    - https://dashscope.aliyuncs.com                （自动补 compatible-mode/v1）
    - https://dashscope.aliyuncs.com/compatible-mode/v1
    - https://xxx/v1/chat/completions               （已是完整地址）
    """
    url = (base_url or "").strip().rstrip("/")
    if not url:
        raise AIServiceError("AI 服务地址未配置，请联系管理员")
    if url.endswith(_CHAT_SUFFIX):
        return url
    if "dashscope.aliyuncs.com" in url and "/compatible-mode" not in url:
        url = f"{url}/compatible-mode/v1"
    return url + _CHAT_SUFFIX


def _is_reasoning_model(model: str) -> bool:
    """推理类模型不接受 temperature 等采样参数，下发会被上游拒绝。"""
    name = (model or "").lower()
    return "r1" in name or "reasoner" in name or "thinking" in name


def _thinking_flag(model: str) -> Optional[bool]:
    """是否下发 enable_thinking。

    百炼 V4 系列默认开启思考：客服场景只需要结论，思维链会额外计费并挤占
    max_tokens，导致正文偏短甚至为空，故默认关闭；可用 AI_ENABLE_THINKING 覆盖。
    """
    if AI_ENABLE_THINKING in {"1", "true", "yes", "on"}:
        return True
    if AI_ENABLE_THINKING in {"0", "false", "no", "off"}:
        return False
    name = (model or "").lower()
    if "v4" in name or "thinking" in name:
        return False
    return None


def _upstream_detail(response: httpx.Response, raw: bytes) -> str:
    """从上游错误体提取 code/message 供服务端日志排查，不回传前端。"""
    try:
        payload = json.loads(raw.decode("utf-8", "ignore"))
    except (ValueError, AttributeError):
        return f"http={response.status_code}"
    error = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(error, dict):
        return f"http={response.status_code} code={error.get('code')} msg={error.get('message')}"
    if isinstance(payload, dict):
        return f"http={response.status_code} code={payload.get('code')} msg={payload.get('message')}"
    return f"http={response.status_code}"


def _friendly_error(status: int) -> str:
    if status in (401, 403):
        return "AI 服务鉴权失败，请联系管理员"
    if status == 429:
        return "AI 服务当前繁忙，请稍后重试"
    if status in (400, 404, 422):
        return "AI 模型配置有误，请联系管理员"
    return "AI 服务暂时不可用，请稍后重试"


async def stream_chat(
    messages: list[dict[str, str]], system_prompt: str
) -> AsyncGenerator[str, None]:
    """请求上游模型并逐段产生回答文本。"""
    if not AI_API_KEY:
        raise AIServiceError("AI 服务尚未配置，请联系管理员")

    payload: dict = {
        "model": AI_MODEL,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "stream": True,
    }
    if AI_MAX_TOKENS > 0:
        payload["max_tokens"] = AI_MAX_TOKENS
    if AI_TEMPERATURE > 0 and not _is_reasoning_model(AI_MODEL):
        payload["temperature"] = AI_TEMPERATURE
    thinking = _thinking_flag(AI_MODEL)
    if thinking is not None:
        payload["enable_thinking"] = thinking

    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    timeout = httpx.Timeout(AI_TIMEOUT_SECONDS, connect=10.0)
    produced = False

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                chat_endpoint(AI_BASE_URL),
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code != 200:
                    raw = await response.aread()
                    logger.warning(
                        "ai_upstream_error model=%s %s", AI_MODEL, _upstream_detail(response, raw)
                    )
                    raise AIServiceError(_friendly_error(response.status_code))

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data:
                        continue
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(event, dict):
                        continue
                    # 上游以 200 返回的业务错误（百炼偶见），需转成可读提示。
                    if event.get("code") and not event.get("choices"):
                        logger.warning(
                            "ai_upstream_event_error model=%s code=%s msg=%s",
                            AI_MODEL, event.get("code"), event.get("message"),
                        )
                        raise AIServiceError("AI 服务暂时不可用，请稍后重试")
                    choices = event.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        produced = True
                        yield content
    except AIServiceError:
        raise
    except httpx.TimeoutException as exc:
        raise AIServiceError("AI 响应超时，请稍后重试") from exc
    except httpx.HTTPError as exc:
        logger.warning("ai_upstream_unreachable model=%s error=%s", AI_MODEL, type(exc).__name__)
        raise AIServiceError("无法连接 AI 服务，请检查网络后重试") from exc

    if not produced:
        raise AIServiceError("AI 未返回内容，请稍后重试")
