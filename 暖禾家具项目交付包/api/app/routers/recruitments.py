"""招聘路由（M2）
接口：
  公开读： GET /api/recruitments?type=&page=&page_size=   招聘中职位分页（type 1 社会/2 校园）
           GET /api/recruitments/{id}                     职位详情
  后台管： GET /api/recruitments/admin?type=&status=&keyword=&page=&page_size=  管理分页
           POST /api/recruitments                新增（description/requirements 富文本清洗）
           PUT  /api/recruitments/{id}           编辑
           DELETE /api/recruitments/{id}         删除（逻辑删除）
           PATCH /api/recruitments/{id}/status   招聘中 / 停用
说明：type 以整数(1/2)存库，响应额外返回 type_label 中文（引 数据库设计文档 3.10 / 实施方案 4.6）。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Recruitment
from app.responses import paginate, success
from app.schemas import RecruitmentCreate, RecruitmentOut, RecruitmentUpdate
from app.security import get_current_user, require_perm
from app.utils import clean_html, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["招聘"])


class StatusAction(BaseModel):
    """启停：传 status 则置为该值，不传则翻转。"""
    status: int | None = None


# ---------------- 公开读 ----------------

@router.get("/api/recruitments", summary="前台招聘列表（招聘中）")
def public_recruitments(
    type: int | None = Query(None, description="1 社会招聘 / 2 校园招聘"),
    page: int = Query(1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Recruitment).filter(Recruitment.status == 1, Recruitment.is_activate == 1)
    if type is not None:
        q = q.filter(Recruitment.type == type)
    total = q.count()
    rows = (
        q.order_by(Recruitment.sort.asc(), Recruitment.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([RecruitmentOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/api/recruitments/admin", summary="后台招聘列表")
def admin_recruitments(
    type: int | None = Query(None),
    status: int | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(10, ge=1, le=100),
    _: AdminUser = Depends(require_perm("recruitment")),
    db: Session = Depends(get_db),
):
    q = db.query(Recruitment).filter(Recruitment.is_activate == 1)
    if type is not None:
        q = q.filter(Recruitment.type == type)
    if status is not None:
        q = q.filter(Recruitment.status == status)
    if keyword:
        q = q.filter(Recruitment.title.contains(keyword))
    total = q.count()
    rows = (
        q.order_by(Recruitment.sort.asc(), Recruitment.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([RecruitmentOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/api/recruitments/{recruit_id}", summary="前台招聘详情")
def public_recruitment_detail(recruit_id: int, db: Session = Depends(get_db)):
    r = db.get(Recruitment, recruit_id)
    if not r or r.status != 1 or r.is_activate != 1:
        raise HTTPException(status_code=404, detail="职位不存在或已停用")
    return success(RecruitmentOut.model_validate(r))


# ---------------- 后台管理 ----------------
@router.post("/api/recruitments", summary="新增招聘职位")
def create_recruitment(
    body: RecruitmentCreate,
    current: AdminUser = Depends(require_perm("recruitment")),
    db: Session = Depends(get_db),
):
    recruit = Recruitment(
        type=body.type,
        title=body.title,
        department=body.department,
        location=body.location,
        description=clean_html(body.description),
        requirements=clean_html(body.requirements),
        sort=body.sort,
        status=body.status,
    )
    set_audit_on_create(recruit, current.username)
    db.add(recruit)
    db.commit()
    db.refresh(recruit)
    return success(RecruitmentOut.model_validate(recruit), msg="创建成功")


@router.put("/api/recruitments/{recruit_id}", summary="编辑招聘职位")
def update_recruitment(
    recruit_id: int,
    body: RecruitmentUpdate,
    current: AdminUser = Depends(require_perm("recruitment")),
    db: Session = Depends(get_db),
):
    recruit = db.get(Recruitment, recruit_id)
    if not recruit:
        raise HTTPException(status_code=404, detail="职位不存在")
    data = body.model_dump(exclude_unset=True)
    if "description" in data and data["description"] is not None:
        data["description"] = clean_html(data["description"])
    if "requirements" in data and data["requirements"] is not None:
        data["requirements"] = clean_html(data["requirements"])
    for k, v in data.items():
        setattr(recruit, k, v)
    set_audit_on_update(recruit, current.username)
    db.commit()
    db.refresh(recruit)
    return success(RecruitmentOut.model_validate(recruit), msg="更新成功")


@router.delete("/api/recruitments/{recruit_id}", summary="删除招聘职位（逻辑删除）")
def delete_recruitment(
    recruit_id: int,
    _: AdminUser = Depends(require_perm("recruitment")),
    db: Session = Depends(get_db),
):
    recruit = db.get(Recruitment, recruit_id)
    if not recruit:
        raise HTTPException(status_code=404, detail="职位不存在")
    recruit.is_activate = 0
    set_audit_on_update(recruit, "system")
    db.commit()
    return success(msg="删除成功")


@router.patch("/api/recruitments/{recruit_id}/status", summary="招聘启停")
def toggle_recruitment_status(
    recruit_id: int,
    body: StatusAction,
    current: AdminUser = Depends(require_perm("recruitment")),
    db: Session = Depends(get_db),
):
    recruit = db.get(Recruitment, recruit_id)
    if not recruit:
        raise HTTPException(status_code=404, detail="职位不存在")
    recruit.status = body.status if body.status is not None else (0 if recruit.status == 1 else 1)
    set_audit_on_update(recruit, current.username)
    db.commit()
    db.refresh(recruit)
    return success(RecruitmentOut.model_validate(recruit), msg="操作成功")
