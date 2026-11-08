"""AI 连通性自检：验证百炼 API Key 与 DeepSeek 模型是否可用。

用法（在项目根目录执行）：
    python api/scripts/ai_check.py
    python api/scripts/ai_check.py --model deepseek-r1
    python api/scripts/ai_check.py --prompt "用一句话介绍暖禾家具" --model deepseek-v3

脚本读取 api/.env 中的 AI_* 配置，发起一次最小流式请求，只打印生成文本与失败原因，
不会输出完整密钥，也不会写入任何业务数据。
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:  # Windows 控制台默认 GBK，中文输出需要显式 UTF-8
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # pragma: no cover
    pass


def mask(key: str) -> str:
    if not key:
        return "(未配置)"
    return f"{key[:4]}****{key[-4:]}" if len(key) > 12 else "****"


async def list_models(base_url: str, api_key: str) -> int:
    """尝试通过兼容接口的 /models 列出可用模型，便于确认模型 ID。"""
    import httpx
    from app.services.deepseek import chat_endpoint

    root = chat_endpoint(base_url)[: -len("/chat/completions")]
    url = f"{root}/models"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
    except httpx.HTTPError as exc:
        print(f"[失败] 无法访问 {url}：{type(exc).__name__}")
        return 1
    if response.status_code != 200:
        print(f"[提示] {url} 返回 {response.status_code}，请到百炼控制台「模型广场」查看模型 ID。")
        return 1
    try:
        items = response.json().get("data") or []
    except ValueError:
        print("[提示] 返回内容不是 JSON，请到百炼控制台「模型广场」查看模型 ID。")
        return 1
    ids = sorted(item.get("id", "") for item in items if isinstance(item, dict))
    print(f"共 {len(ids)} 个模型：")
    for model_id in ids:
        print(f"  - {model_id}")
    return 0


async def main(model: str, prompt: str, show_models: bool) -> int:
    try:
        from app import config
        from app.services import deepseek
    except RuntimeError as exc:  # JWT_SECRET 等必填项缺失时 config 会抛错
        print(f"[配置错误] {exc}")
        return 2

    if model:
        config.AI_MODEL = model
        deepseek.AI_MODEL = model

    print(f"endpoint : {deepseek.chat_endpoint(config.AI_BASE_URL)}")
    print(f"model    : {config.AI_MODEL}")
    print(f"api_key  : {mask(config.AI_API_KEY)}")
    thinking = deepseek._thinking_flag(config.AI_MODEL)
    print(f"thinking : {'默认（跟随模型）' if thinking is None else ('开启' if thinking else '关闭')}")
    if not config.AI_API_KEY:
        print("[提示] 未配置 AI_API_KEY：请在 api/.env 填入百炼 API Key 后重试。")
        return 2

    if show_models:
        return await list_models(config.AI_BASE_URL, config.AI_API_KEY)

    print("--- 上游返回 ---")
    total = 0
    try:
        async for chunk in deepseek.stream_chat(
            [{"role": "user", "content": prompt}],
            "你是连通性测试助手，请用一句简短中文回答。",
        ):
            print(chunk, end="", flush=True)
            total += len(chunk)
    except deepseek.AIServiceError as exc:
        print(f"\n[失败] {exc}")
        print("排查顺序：")
        print("  1. API Key 是否为百炼「个人 API Key」（应用 Key 需额外授权）")
        print("  2. AI_MODEL 是否与百炼模型广场的模型 ID 完全一致且已开通")
        print("  3. 账户额度、模型限流与地域是否匹配")
        print("  4. 用 --list 查看该 Key 可访问的模型，或 --model 临时切换后再试")
        return 1

    print(f"\n--- 成功：共 {total} 字 ---")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI 上游连通性自检")
    parser.add_argument("--model", default="", help="临时覆盖模型 ID，如 deepseek-v4-flash-0731")
    parser.add_argument("--prompt", default="你好，请回复：连接成功", help="测试提问")
    parser.add_argument("--list", action="store_true", dest="show_models", help="列出可用模型 ID")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.model, args.prompt, args.show_models)))
