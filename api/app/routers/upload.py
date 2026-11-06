"""文件上传路由
接口： POST /api/upload   需登录且已完成首次改密，上传图片
校验： 先按声明类型初筛，再按文件魔数确定真实类型；流式分块读取，超过 5MB 立即中止。
说明：
  - 不引入 Pillow 等额外依赖，用标准魔数签名识别 jpeg / png / webp，避免云函数打包膨胀。
  - 扩展名一律由魔数推导，不信任客户端 filename 与 Content-Type。
  - 静态目录由 main.py 精确挂载，且统一响应带 X-Content-Type-Options: nosniff。
"""
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.db import get_db
from app.models import AdminUser
from app.responses import success
from app.security import get_current_user

router = APIRouter(tags=["文件上传"])

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE = 5 * 1024 * 1024          # 5MB
_CHUNK = 64 * 1024
_SIGNATURES = (
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
)


def _detect_ext(data: bytes) -> str | None:
    """按文件头魔数判定真实图片类型，返回统一扩展名。"""
    for sig, ext in _SIGNATURES:
        if data.startswith(sig):
            return ext
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


@router.post("/api/upload", summary="上传图片（登录后）")
async def upload_file(
    file: UploadFile = File(...),
    _: AdminUser = Depends(get_current_user),
    db: Session = Depends(get_db),   # 仅用于依赖注入占位；实际无需写库
):
    # 1. 声明类型快速初筛（真正的校验在魔数）
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 jpg / png / webp 图片")
    if getattr(file, "size", 0) and file.size > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 5MB")

    # 2. 流式分块读取，超限立即中止，避免整包读进内存
    buf = bytearray()
    while True:
        chunk = await file.read(_CHUNK)
        if not chunk:
            break
        if len(buf) + len(chunk) > _MAX_SIZE:
            raise HTTPException(status_code=400, detail="文件大小不能超过 5MB")
        buf.extend(chunk)
    data = bytes(buf)
    if not data:
        raise HTTPException(status_code=400, detail="文件内容为空")

    # 3. 魔数校验：类型与扩展名均由内容推导
    ext = _detect_ext(data)
    if ext is None:
        raise HTTPException(status_code=400, detail="文件内容不是有效的 jpg / png / webp 图片")
    filename = f"{uuid.uuid4().hex}{ext}"

    # 4. 落盘（uuid 命名，不使用原始文件名，天然规避路径穿越）
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(data)

    # 5. 返回可访问 URL（相对路径；部署版由 build.py 改写为 /api/static/uploads/...）
    return success({"url": f"/static/uploads/{filename}"}, msg="上传成功")
