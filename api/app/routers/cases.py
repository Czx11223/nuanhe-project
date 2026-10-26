"""案例展示路由（M2）
接口：
  公开读： GET /api/cases?category=&page=&page_size=   启用案例分页
           GET /api/cases/{id}                         案例详情
  后台管： GET /api/cases/admin                        全部
           POST /api/cases                新增（content 富文本清洗）
           PUT  /api/cases/{id}           编辑
           DELETE /api/cases/{id}         删除（逻辑删除）
           PATCH /api/cases/{id}/top      置顶（将 sort 置为当前最小值-1，使排序最前）
说明：case 表无独立“置顶”字段（引 数据库设计文档 3.9），故用 sort 实现置顶，
      避免对权威表结构做字段扩展；前端按 sort 升序展示时置顶项排在最前。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Case
from app.responses import paginate, success
from app.schemas import CaseCreate, CaseOut, CaseUpdate
from app.security import get_current_user, require_perm
from app.utils import clean_html, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["案例展示"])


# ---------------- 公开读 ----------------

@router.get("/api/cases", summary="前台案例列表（启用）")
def public_cases(
    category: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(9, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Case).filter(Case.status == 1, Case.is_activate == 1)
    if category:
        q = q.filter(Case.category == category)
    total = q.count()
    rows = (
        q.order_by(Case.sort.asc(), Case.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([CaseOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/api/cases/admin", summary="后台案例列表（分页）")
def admin_cases(
    keyword: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(10, ge=1, le=100),
    _: AdminUser = Depends(require_perm("case")),
    db: Session = Depends(get_db),
):
    # 后台案例列表：支持标题关键词过滤 + 分页，返回 {list,total,page,page_size}，
    # 与 products/news/recruitments 后台列表契约保持一致（原为全量数组，本次统一分页）。
    q = db.query(Case).filter(Case.is_activate == 1)
    if keyword:
        q = q.filter(Case.title.contains(keyword))
    total = q.count()
    rows = (
        q.order_by(Case.sort.asc(), Case.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([CaseOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/api/cases/{case_id}", summary="前台案例详情")
def public_case_detail(case_id: int, db: Session = Depends(get_db)):
    c = db.get(Case, case_id)
    if not c or c.status != 1 or c.is_activate != 1:
        raise HTTPException(status_code=404, detail="案例不存在或已停用")
    return success(CaseOut.model_validate(c))


# ---------------- 后台管理 ----------------
@router.post("/api/cases", summary="新增案例")
def create_case(
    body: CaseCreate,
    current: AdminUser = Depends(require_perm("case")),
    db: Session = Depends(get_db),
):
    case = Case(
        title=body.title,
        category=body.category,
        cover_image=body.cover_image,
        summary=body.summary,
        content=clean_html(body.content),
        sort=body.sort,
        status=body.status,
    )
    set_audit_on_create(case, current.username)
    db.add(case)
    db.commit()
    db.refresh(case)
    return success(CaseOut.model_validate(case), msg="创建成功")


@router.put("/api/cases/{case_id}", summary="编辑案例")
def update_case(
    case_id: int,
    body: CaseUpdate,
    current: AdminUser = Depends(require_perm("case")),
    db: Session = Depends(get_db),
):
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    data = body.model_dump(exclude_unset=True)
    if "content" in data and data["content"] is not None:
        data["content"] = clean_html(data["content"])
    for k, v in data.items():
        setattr(case, k, v)
    set_audit_on_update(case, current.username)
    db.commit()
    db.refresh(case)
    return success(CaseOut.model_validate(case), msg="更新成功")


@router.delete("/api/cases/{case_id}", summary="删除案例（逻辑删除）")
def delete_case(
    case_id: int,
    _: AdminUser = Depends(require_perm("case")),
    db: Session = Depends(get_db),
):
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    case.is_activate = 0
    set_audit_on_update(case, "system")
    db.commit()
    return success(msg="删除成功")


@router.patch("/api/cases/{case_id}/top", summary="案例置顶")
def top_case(
    case_id: int,
    current: AdminUser = Depends(require_perm("case")),
    db: Session = Depends(get_db),
):
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    # 将 sort 设为当前最小值 -1，使其在升序排列中排到最前（实现置顶）
    min_sort = db.query(func.min(Case.sort)).scalar()
    case.sort = (min_sort if min_sort is not None else 0) - 1
    set_audit_on_update(case, current.username)
    db.commit()
    db.refresh(case)
    return success(CaseOut.model_validate(case), msg="已置顶")
