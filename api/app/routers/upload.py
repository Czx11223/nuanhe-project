"""文件上传路由（M2）
接口： POST /api/upload   需登录（任意已登录管理员），上传图片
校验： 仅允许 image/jpeg|png|webp，大小 ≤ 5MB；存储于 static/uploads/，
       返回 {url:"/static/uploads/xxx"}（前端拼接 BASE 即可访问）。
说明：
  - 上传为内部工具，鉴权只需“已登录”（get_current_user）即可，具体内容的 RBAC 由
    各内容接口（product/news/...）保证；此处不绑定单一权限键（引 技术文档 4.4 示例放开）。
  - 静态目录已由 main.py 挂载到 /static，上传文件可直接通过 /static/uploads/xxx 访问。
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


@router.post("/api/upload", summary="上传图片（登录后）")
async def upload_file(
    file: UploadFile = File(...),
    _: AdminUser = Depends(get_current_user),
    db: Session = Depends(get_db),   # 仅用于依赖注入占位；实际无需写库
):
    # 1. 类型校验
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 jpg / png / webp 图片")
    # 2. 读取内容并校验大小
    data = await file.read()
    if len(data) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 5MB")

    # 3. 生成唯一文件名（保留原始扩展名）
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"

    # 4. 落盘（确保目录存在）
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    save_path = os.path.join(UPLOAD_DIR, filename)
    with open(save_path, "wb") as f:
        f.write(data)

    # 5. 返回可访问 URL（相对路径，前端拼接 BASE）
    return success({"url": f"/static/uploads/{filename}"}, msg="上传成功")
