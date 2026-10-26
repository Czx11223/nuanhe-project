"""产品分类路由（M2）
接口：
  公开读： GET /api/product-categories           分类树（启用中，含 children 嵌套）
  后台管： GET /api/product-categories/admin     分类树（含停用）
           POST /api/product-categories          新增
           PUT  /api/product-categories/{id}     编辑（校验父分类）
           DELETE /api/product-categories/{id}   删除（校验无关联产品后逻辑删除）
说明：支持二级分类（parent_id 自引用）；删除前校验该分类下无产品，否则拒绝（引 数据库设计文档 2.1 / 实施方案 4.6）。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Product, ProductCategory
from app.responses import success
from app.schemas import ProductCategoryCreate, ProductCategoryOut, ProductCategoryUpdate
from app.security import get_current_user, require_perm
from app.utils import set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["产品分类"])


def _build_tree(rows) -> list:
    """依据 parent_id 把扁平列表构建为树形（children 嵌套）。"""
    # 先按 sort/id 排序，保证输出稳定
    rows = sorted(rows, key=lambda c: (c.sort or 0, c.id))
    nodes = {c.id: ProductCategoryOut.model_validate(c) for c in rows}
    roots = []
    for c in rows:
        node = nodes[c.id]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


@router.get("/api/product-categories", summary="前台产品分类树")
def public_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(ProductCategory)
        .filter(ProductCategory.status == 1, ProductCategory.is_activate == 1)
        .all()
    )
    return success(_build_tree(rows))


@router.get("/api/product-categories/admin", summary="后台产品分类树")
def admin_categories(
    _: AdminUser = Depends(require_perm("product_category")),
    db: Session = Depends(get_db),
):
    rows = db.query(ProductCategory).filter(ProductCategory.is_activate == 1).all()
    return success(_build_tree(rows))


@router.post("/api/product-categories", summary="新增产品分类")
def create_category(
    body: ProductCategoryCreate,
    current: AdminUser = Depends(require_perm("product_category")),
    db: Session = Depends(get_db),
):
    if body.parent_id is not None and not db.get(ProductCategory, body.parent_id):
        raise HTTPException(status_code=400, detail="父分类不存在")
    cat = ProductCategory(
        name=body.name,
        parent_id=body.parent_id,
        sort=body.sort,
        status=body.status,
    )
    set_audit_on_create(cat, current.username)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return success(ProductCategoryOut.model_validate(cat), msg="创建成功")


@router.put("/api/product-categories/{cat_id}", summary="编辑产品分类")
def update_category(
    cat_id: int,
    body: ProductCategoryUpdate,
    current: AdminUser = Depends(require_perm("product_category")),
    db: Session = Depends(get_db),
):
    cat = db.get(ProductCategory, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    data = body.model_dump(exclude_unset=True)
    # 校验父分类存在、不能指向自己、不能移动到自己的后代下（防循环引用）
    if "parent_id" in data:
        pid = data["parent_id"]
        if pid is not None:
            if pid == cat_id:
                raise HTTPException(status_code=400, detail="父分类不能指向自身")
            if not db.get(ProductCategory, pid):
                raise HTTPException(status_code=400, detail="父分类不存在")
            # 沿祖先链上溯，若出现 cat_id 说明会把 cat_id 挂到自己的子分类下，形成环
            cur = db.get(ProductCategory, pid)
            while cur and cur.parent_id is not None:
                if cur.parent_id == cat_id:
                    raise HTTPException(status_code=400, detail="不能将分类移动到其子分类下")
                cur = db.get(ProductCategory, cur.parent_id)
    for k, v in data.items():
        setattr(cat, k, v)
    set_audit_on_update(cat, current.username)
    db.commit()
    db.refresh(cat)
    return success(ProductCategoryOut.model_validate(cat), msg="更新成功")


@router.delete("/api/product-categories/{cat_id}", summary="删除产品分类（级联子分类，校验无关联产品）")
def delete_category(
    cat_id: int,
    _: AdminUser = Depends(require_perm("product_category")),
    db: Session = Depends(get_db),
):
    cat = db.get(ProductCategory, cat_id)
    # 已逻辑删除的记录再次删除：明确返回 404，避免用户误以为删除未生效
    if not cat or cat.is_activate != 1:
        raise HTTPException(status_code=404, detail="分类不存在或已删除")

    # 收集整棵子树（含自身），防止删除父分类后其子分类成为孤儿（parent_id 悬空）
    def collect(pid: int, acc: list) -> list:
        kids = (
            db.query(ProductCategory)
            .filter(ProductCategory.parent_id == pid, ProductCategory.is_activate == 1)
            .all()
        )
        for k in kids:
            acc.append(k)
            collect(k.id, acc)
        return acc

    subtree = [cat] + collect(cat_id, [])
    ids = [c.id for c in subtree]

    # 删除前校验：子树内任一分类仍关联产品则整体拒绝（引 数据库设计文档 2.1）
    if db.query(Product).filter(Product.category_id.in_(ids)).first():
        raise HTTPException(status_code=400, detail="该分类或其子分类下存在产品，无法删除")

    # 级联逻辑删除：整个子树统一置 is_activate=0，保持父子关联完整
    for c in subtree:
        c.is_activate = 0
        set_audit_on_update(c, "system")
    db.commit()
    sub_cnt = len(subtree) - 1
    return success(msg=f"删除成功{'（含 ' + str(sub_cnt) + ' 个子分类）' if sub_cnt > 0 else ''}")
