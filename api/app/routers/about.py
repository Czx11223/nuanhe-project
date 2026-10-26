"""关于我们路由（M2）
接口：
  公开读： GET /api/about-contents?section=    启用的板块列表（可按 section 过滤）
  后台管： GET /api/about-contents/admin       全部（含停用）
           POST /api/about-contents           新增
           PUT  /api/about-contents/{id}      编辑（content 富文本入库前清洗）
           DELETE /api/about-contents/{id}    删除（逻辑删除）
说明：section 取值 about_暖禾 / history / brand（引 数据库设计文档 1.3）。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AboutContent, AdminUser
from app.responses import success
from app.schemas import AboutContentCreate, AboutContentOut, AboutContentUpdate
from app.security import get_current_user, require_perm
from app.utils import clean_html, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["关于我们"])


@router.get("/api/about-contents", summary="前台关于我们板块")
def public_about(section: str | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(AboutContent).filter(
        AboutContent.status == 1, AboutContent.is_activate == 1
    )
    if section:
        q = q.filter(AboutContent.section == section)
    rows = q.order_by(AboutContent.sort.asc(), AboutContent.id.asc()).all()
    return success([AboutContentOut.model_validate(r) for r in rows])


@router.get("/api/about-contents/admin", summary="后台关于我们列表")
def admin_about(
    _: AdminUser = Depends(require_perm("about")),
    db: Session = Depends(get_db),
):
    rows = db.query(AboutContent).order_by(AboutContent.sort.asc(), AboutContent.id.asc()).all()
    return success([AboutContentOut.model_validate(r) for r in rows])


@router.post("/api/about-contents", summary="新增关于我们板块")
def create_about(
    body: AboutContentCreate,
    current: AdminUser = Depends(require_perm("about")),
    db: Session = Depends(get_db),
):
    about = AboutContent(
        section=body.section,
        title=body.title,
        content=clean_html(body.content),   # 富文本白名单清洗
        image_url=body.image_url,
        sort=body.sort,
        status=body.status,
    )
    set_audit_on_create(about, current.username)
    db.add(about)
    db.commit()
    db.refresh(about)
    return success(AboutContentOut.model_validate(about), msg="创建成功")


@router.put("/api/about-contents/{about_id}", summary="编辑关于我们板块")
def update_about(
    about_id: int,
    body: AboutContentUpdate,
    current: AdminUser = Depends(require_perm("about")),
    db: Session = Depends(get_db),
):
    about = db.get(AboutContent, about_id)
    if not about:
        raise HTTPException(status_code=404, detail="内容不存在")
    data = body.model_dump(exclude_unset=True)
    if "content" in data:
        data["content"] = clean_html(data["content"])
    for k, v in data.items():
        setattr(about, k, v)
    set_audit_on_update(about, current.username)
    db.commit()
    db.refresh(about)
    return success(AboutContentOut.model_validate(about), msg="更新成功")


@router.delete("/api/about-contents/{about_id}", summary="删除关于我们板块（逻辑删除）")
def delete_about(
    about_id: int,
    _: AdminUser = Depends(require_perm("about")),
    db: Session = Depends(get_db),
):
    about = db.get(AboutContent, about_id)
    if not about:
        raise HTTPException(status_code=404, detail="内容不存在")
    about.is_activate = 0
    set_audit_on_update(about, "system")
    db.commit()
    return success(msg="删除成功")
