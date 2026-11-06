"""暖禾项目 E2E 冒烟测试（可复现、只读真实数据）。

用法：python tests/smoke.py [local|cloud|all]，默认 all。

- local：本地 FastAPI 应用（/api/... 路由），用临时 SQLite 与临时上传目录。
- cloud：EdgeOne 云函数副本（剥离 /api 后的路由），模拟冷启动从 init.sql 建库。
两个 suite 在独立子进程中运行，避免同名 `app` 包相互污染。
"""
import asyncio
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PASS: list[str] = []
FAIL: list[str] = []


def check(label: str, cond: bool, extra: str = "") -> None:
    (PASS if cond else FAIL).append(label)
    print(("  OK   " if cond else "  FAIL ") + label + (f"  {extra}" if extra else ""))


def prepare_env() -> tempfile.TemporaryDirectory:
    tmp = tempfile.TemporaryDirectory(prefix="nuanhe_smoke_", ignore_cleanup_errors=True)
    os.environ["DB_PATH"] = str(Path(tmp.name) / "smoke.db")
    os.environ["UPLOAD_DIR"] = str(Path(tmp.name) / "uploads")
    os.environ["ADMIN_INIT_PASSWORD"] = "SmokeTest@2026"
    os.environ["JWT_SECRET"] = "smoke-only-secret-" + ("x" * 32)
    return tmp


async def run_local() -> None:
    sys.path.insert(0, str(ROOT / "api"))
    import httpx
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import IntegrityError
    from app.main import app
    from app.models import Base
    from app.db import SessionLocal, engine
    from app.models import Message

    async def boom():
        raise IntegrityError("INSERT", None, Exception("UNIQUE constraint failed"))

    app.add_api_route("/__smoke_integrity", boom, methods=["GET"])

    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            print("\n--- 公开接口与安全头 ---")
            r = await c.get("/api/health")
            check("GET /api/health 200", r.status_code == 200, str(r.status_code))
            r = await c.get("/api/products")
            check("GET /api/products 200", r.status_code == 200, str(r.status_code))
            check("响应带 nosniff", r.headers.get("X-Content-Type-Options") == "nosniff")
            check("响应带 X-Frame-Options", r.headers.get("X-Frame-Options") == "SAMEORIGIN")

            print("\n--- 登录与首次改密 ---")
            r = await c.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
            check("错误口令 401", r.status_code == 401, str(r.status_code))
            r = await c.post("/api/auth/login", json={"username": "admin", "password": "SmokeTest@2026"})
            check("正确口令 200", r.status_code == 200, str(r.status_code))
            token = r.json()["data"]["access_token"]
            check("首次登录标记 must_change_password", r.json()["data"]["must_change_password"] is True)
            h = {"Authorization": f"Bearer {token}"}
            r = await c.get("/api/auth/me", headers=h)
            check("/auth/me 返回服务端权威改密标记", r.json()["data"].get("must_change_password") is True)
            r = await c.get("/api/banners/admin", headers=h)
            check("未改密访问后台列表 403", r.status_code == 403, str(r.status_code))
            r = await c.post("/api/upload", headers=h,
                             files={"file": ("a.png", b"\x89PNG\r\n\x1a\n123", "image/png")})
            check("未改密访问 upload 403", r.status_code == 403, str(r.status_code))

            print("\n--- 匿名留言 XSS 与限流 ---")
            payload = {"name": "<img src=x onerror=alert(1)>张三", "phone": "13800000000",
                       "type": "留言", "content": "<script>alert('xss')</script>你好<b>世界</b>"}
            r = await c.post("/api/messages", json=payload)
            check("POST /api/messages 200", r.status_code == 200, str(r.status_code))
            db = SessionLocal()
            try:
                row = db.query(Message).order_by(Message.id.desc()).first()
                check("留言 content 已剥净标签", row is not None and "<" not in (row.content or ""))
                check("留言 name 已剥净标签", row is not None and "<" not in (row.name or ""))
            finally:
                db.close()
            check("同 IP 二次提交 429",
                  (await c.post("/api/messages", json=payload)).status_code == 429)
            check("换手机号不能绕过限流",
                  (await c.post("/api/messages", json={**payload, "phone": "13999999999"})).status_code == 429)

            print("\n--- 改密后放行 ---")
            r = await c.post("/api/auth/change-password", headers=h, json={
                "old_password": "SmokeTest@2026", "new_password": "SmokeTest@2026-New"})
            check("改密 200", r.status_code == 200, str(r.status_code))
            h2 = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
            check("改密后后台列表 200", (await c.get("/api/banners/admin", headers=h2)).status_code == 200)
            check("改密后 /auth/me 标记清除",
                  (await c.get("/api/auth/me", headers=h2)).json()["data"]["must_change_password"] is False)

            print("\n--- 上传与静态目录 ---")
            r = await c.post("/api/upload", headers=h2,
                             files={"file": ("e.html", b"<html><script>x</script></html>", "image/png")})
            check("伪造 Content-Type 的 HTML 400", r.status_code == 400, str(r.status_code))
            r = await c.post("/api/upload", headers=h2,
                             files={"file": ("x.txt", b"not an image", "image/jpeg")})
            check("声明 jpeg 的非图片 400", r.status_code == 400, str(r.status_code))
            r = await c.post("/api/upload", headers=h2,
                             files={"file": ("r.dat", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "image/png")})
            check("真实 PNG 上传 200", r.status_code == 200, str(r.status_code))
            url = r.json()["data"]["url"] if r.status_code == 200 else ""
            check("扩展名由魔数推导 .png", url.endswith(".png"), url)
            if url:
                rs = await c.get(url)
                check("上传文件可访问且带 nosniff",
                      rs.status_code == 200 and rs.headers.get("X-Content-Type-Options") == "nosniff")
            check("/static/app.db 不可越权访问",
                  (await c.get("/static/app.db")).status_code in (404, 405))
            check("IntegrityError 映射 409",
                  (await c.get("/__smoke_integrity")).status_code == 409)

            print("\n--- 数据层 ---")
            with engine.begin() as conn:
                check("PRAGMA foreign_keys=ON",
                      conn.execute(text("PRAGMA foreign_keys")).scalar() == 1)
                try:
                    conn.execute(text("UPDATE admin_user SET role_id=99999 WHERE id=1"))
                    check("外键拦截悬空 role_id", False)
                except IntegrityError:
                    check("外键拦截悬空 role_id", True)

    e2 = create_engine(f"sqlite:///{Path(os.environ['DB_PATH']).parent / 'idx.db'}")
    Base.metadata.create_all(e2)
    with e2.connect() as conn:
        names = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='index'"))}
    expected = {"idx_product_category", "idx_news_category", "idx_news_publish",
                "idx_case_status", "idx_recruitment_type", "idx_message_status", "idx_admin_role"}
    check("7 个索引随 create_all 建立", not (expected - names), str(sorted(expected - names)))

    env = os.environ.copy()
    env["JWT_SECRET"] = "change_me_in_prod"
    p = subprocess.run(
        [sys.executable, "-c", "import sys; sys.path.insert(0, r'" + str(ROOT / "api") + "'); import app.config"],
        env=env, capture_output=True, text=True,
    )
    check("示例/空密钥时启动直接失败", p.returncode != 0 and "JWT_SECRET" in p.stderr)


async def run_cloud() -> None:
    cf = ROOT / "edgeone-app" / "cloud-functions"
    sys.path.insert(0, str(cf))
    data = pathlib.Path("/tmp/nuanhe")
    if data.exists():
        shutil.rmtree(data)
    import httpx
    from sqlalchemy import text
    from api.index import app
    from app.db import engine

    async with app.router.lifespan_context(app):
        print("\n--- 云函数冷启动 ---")
        check("数据库自动生成", (data / "app.db").exists())
        with engine.connect() as conn:
            tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
            check("init.sql 建表 >= 12 张", len(tables) >= 12, f"count={len(tables)}")
            check("seed() 生成管理员", conn.execute(text("SELECT count(*) FROM admin_user")).scalar() == 1)

        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            check("GET /health 200（前缀已剥离）", (await c.get("/health")).status_code == 200)
            check("GET /products 200", (await c.get("/products")).status_code == 200)
            r = await c.post("/auth/login", json={"username": "admin", "password": "SmokeTest@2026"})
            check("ADMIN_INIT_PASSWORD 可登录", r.status_code == 200, str(r.status_code))
            h = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
            check("未改密访问后台 403", (await c.get("/banners/admin", headers=h)).status_code == 403)
            r = await c.post("/auth/change-password", headers=h, json={
                "old_password": "SmokeTest@2026", "new_password": "SmokeTest@2026-New"})
            check("改密 200", r.status_code == 200, str(r.status_code))
            h2 = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
            check("改密后后台 200", (await c.get("/banners/admin", headers=h2)).status_code == 200)
            r = await c.post("/upload", headers=h2,
                             files={"file": ("x.dat", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32, "image/png")})
            check("POST /upload 200", r.status_code == 200, str(r.status_code))
            url = r.json()["data"]["url"] if r.status_code == 200 else ""
            check("返回 /api/static/uploads/...", url.startswith("/api/static/uploads/"), url)
            check("POST /messages 200",
                  (await c.post("/messages", json={"name": "测试", "type": "留言", "content": "ok"})).status_code == 200)


def main() -> int:
    suite = sys.argv[1] if len(sys.argv) > 1 else "all"
    if suite == "all":
        codes = [subprocess.run([sys.executable, __file__, s]).returncode for s in ("local", "cloud")]
        return 1 if any(codes) else 0
    if suite not in ("local", "cloud"):
        print("用法: python tests/smoke.py [local|cloud|all]")
        return 2
    print(f"===== suite: {suite} =====")
    tmp = prepare_env()
    try:
        asyncio.run(run_local() if suite == "local" else run_cloud())
    finally:
        tmp.cleanup()
    print(f"\n[{suite}] 结果: {len(PASS)} 通过 / {len(FAIL)} 失败")
    if FAIL:
        print("失败项:", ", ".join(FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
