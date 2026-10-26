"""轮播图路由（M2）
接口：
  公开读： GET /api/banners                 启用中的轮播图（status=1, is_activate=1, sort 升序）
  后台管： GET /api/banners/admin            全部（含停用）
           POST /api/banners                新增
           PUT  /api/banners/{id}           编辑
           DELETE /api/banners/{id}         删除（逻辑删除 is_activate=0）
           PATCH /api/banners/{id}/status   启停切换（status 1/0）
说明：内容表删除统一走“逻辑删除”（is_activate=0），不物理删除（引 数据库设计文档 3.2 / 实施方案 3.2）。
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Banner
from app.responses import success
from app.schemas import BannerCreate, BannerOut, BannerUpdate
from app.security import get_current_user, require_perm
from app.utils import clean_html, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["轮播图"])


class StatusAction(BaseModel):
    """启停动作：传 status 则置为该值，不传则翻转。"""
    status: int | None = None


# ---------------- 公开读 ----------------
@router.get("/api/banners", summary="前台轮播图（启用中）")
def public_banners(db: Session = Depends(get_db)):
    rows = (
        db.query(Banner)
        .filter(Banner.status == 1, Banner.is_activate == 1)
        .order_by(Banner.sort.asc(), Banner.id.asc())
        .all()
    )
    return success([BannerOut.model_validate(r) for r in rows])


# ---------------- 后台管理 ----------------
@router.get("/api/banners/admin", summary="后台轮播图列表（含停用）")
def admin_banners(
    _: AdminUser = Depends(require_perm("banner")),
    db: Session = Depends(get_db),
):
    rows = db.query(Banner).order_by(Banner.sort.asc(), Banner.id.asc()).all()
    return success([BannerOut.model_validate(r) for r in rows])


@router.post("/api/banners", summary="新增轮播图")
def create_banner(
    body: BannerCreate,
    current: AdminUser = Depends(require_perm("banner")),
    db: Session = Depends(get_db),
):
    banner = Banner(
        title=body.title,
        image_url=body.image_url,
        link_url=body.link_url,
        sort=body.sort,
        status=body.status,
    )
    set_audit_on_create(banner, current.username)
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return success(BannerOut.model_validate(banner), msg="创建成功")


@router.put("/api/banners/{banner_id}", summary="编辑轮播图")
def update_banner(
    banner_id: int,
    body: BannerUpdate,
    current: AdminUser = Depends(require_perm("banner")),
    db: Session = Depends(get_db),
):
    banner = db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(banner, k, v)
    set_audit_on_update(banner, current.username)
    db.commit()
    db.refresh(banner)
    return success(BannerOut.model_validate(banner), msg="更新成功")


@router.delete("/api/banners/{banner_id}", summary="删除轮播图（逻辑删除）")
def delete_banner(
    banner_id: int,
    _: AdminUser = Depends(require_perm("banner")),
    db: Session = Depends(get_db),
):
    banner = db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    banner.is_activate = 0          # 逻辑删除，不物理删除
    set_audit_on_update(banner, "system")  # 删除操作修改人记 system（实际由谁操作可扩展）
    db.commit()
    return success(msg="删除成功")


@router.patch("/api/banners/{banner_id}/status", summary="轮播图启停")
def toggle_banner_status(
    banner_id: int,
    body: StatusAction,
    current: AdminUser = Depends(require_perm("banner")),
    db: Session = Depends(get_db),
):
    banner = db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    banner.status = body.status if body.status is not None else (0 if banner.status == 1 else 1)
    set_audit_on_update(banner, current.username)
    db.commit()
    db.refresh(banner)
    return success(BannerOut.model_validate(banner), msg="操作成功")
