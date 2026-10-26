"""留言反馈路由（M2）
接口：
  公开写： POST /api/messages                提交留言/预约/咨询/简历投递（带 60s 限流）
  后台管： GET /api/messages?status=&type=&keyword=&page=&page_size=  列表
           PUT /api/messages/{id}            标记处理/忽略 + 回复
说明：
  - 公开提交不限 Token，但按「客户端 IP + 手机号」做 60s 内仅 1 次限制（引 PRD 8.2 / 技术文档 6.2）。
  - 留言 status：0 待处理 / 1 已处理 / 2 已忽略；标记处理后写入 handled_at。
"""
import threading
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Message
from app.responses import paginate, success
from app.schemas import MessageCreate, MessageOut, MessageUpdate
from app.security import get_current_user, require_perm
from app.utils import set_audit_on_update

router = APIRouter(tags=["留言反馈"])

# ----------------- 限流（内存级，演示用） -----------------
_RATE_LOCK = threading.Lock()
_RATE_RECORDS: dict[str, float] = {}     # key -> 上次提交时间戳（monotonic 秒）
_RATE_WINDOW = 60                         # 窗口 60 秒，单 key 仅允许 1 次


async def rate_limit_messages(request: Request) -> None:
    """按 IP + 手机号限制提交频率：60s 内同一 key 仅允许 1 次，超出返回 429。"""
    ip = request.client.host if request.client else "unknown"
    try:
        body = await request.json()
        phone = (body.get("phone") or "").strip()
    except Exception:
        phone = ""
    key = f"{ip}:{phone}"
    now = time.monotonic()
    with _RATE_LOCK:
        last = _RATE_RECORDS.get(key)
        if last is not None and (now - last) < _RATE_WINDOW:
            raise HTTPException(status_code=429, detail="提交过于频繁，请稍后再试")
        _RATE_RECORDS[key] = now


# ---------------- 公开提交 ----------------
@router.post("/api/messages", summary="前台提交留言/预约/投递", dependencies=[Depends(rate_limit_messages)])
def create_message(body: MessageCreate, db: Session = Depends(get_db)):
    msg = Message(
        name=body.name,
        phone=body.phone,
        email=body.email,
        type=body.type,
        content=body.content,
        status=0,                 # 初始待处理
        created_at=body.name,     # 公开提交无登录用户，创建人记为来访者姓名
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return success({"id": msg.id}, msg="提交成功")


# ---------------- 后台管理 ----------------
@router.get("/api/messages", summary="后台留言列表")
def list_messages(
    status: int | None = Query(None),
    type: str | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(15, ge=1, le=100),
    _: AdminUser = Depends(require_perm("message")),
    db: Session = Depends(get_db),
):
    q = db.query(Message).filter(Message.is_activate == 1)
    if status is not None:
        q = q.filter(Message.status == status)
    if type:
        q = q.filter(Message.type == type)
    if keyword:
        q = q.filter(Message.name.contains(keyword) | Message.content.contains(keyword))
    total = q.count()
    rows = (
        q.order_by(Message.created_date.desc(), Message.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([MessageOut.model_validate(r) for r in rows], total, page, page_size)


@router.put("/api/messages/{msg_id}", summary="处理 / 回复留言")
def update_message(
    msg_id: int,
    body: MessageUpdate,
    current: AdminUser = Depends(require_perm("message")),
    db: Session = Depends(get_db),
):
    msg = db.get(Message, msg_id)
    if not msg:
        raise HTTPException(status_code=404, detail="留言不存在")
    data = body.model_dump(exclude_unset=True)
    # 标记已处理/已忽略时写入处理时间
    if "status" in data and data["status"] in (1, 2) and not msg.handled_at:
        msg.handled_at = datetime.utcnow()
    for k, v in data.items():
        setattr(msg, k, v)
    set_audit_on_update(msg, current.username)
    db.commit()
    db.refresh(msg)
    return success(MessageOut.model_validate(msg), msg="操作成功")
