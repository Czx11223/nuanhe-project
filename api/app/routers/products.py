"""产品路由（M2）
接口：
  公开读： GET /api/products?category_id=&keyword=&page=&page_size=   上架产品分页
           GET /api/products/{id}                                    产品详情（含 gallery/specs/description）
  后台管： GET /api/products/admin?category_id=&keyword=&status=&page=&page_size=  管理分页
           POST /api/products               新增（gallery 多图、description 富文本清洗）
           PUT  /api/products/{id}          编辑
           DELETE /api/products/{id}        删除（逻辑删除）
           PATCH /api/products/{id}/status  上架 / 下架
           PATCH /api/products/{id}/recommend  首页推荐切换
说明：gallery 以 JSON 数组入库（TEXT）；description 入库前 bleach 清洗（引 技术文档 4.5）。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Product, ProductCategory
from app.responses import paginate, success
from app.schemas import ProductCreate, ProductOut, ProductUpdate
from app.security import get_current_user, require_perm
from app.utils import clean_html, dumps_json, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["产品"])


class FlagAction(BaseModel):
    """状态切换：传值则置为该值，不传则翻转（用于上下架 / 推荐）。"""
    status: int | None = None


def _to_product_out(p: Product, cat_map: dict) -> ProductOut:
    """构造 ProductOut 并补充分类名称（category_name）。"""
    out = ProductOut.model_validate(p)
    out.category_name = cat_map.get(p.category_id) if p.category_id else None
    return out


def _category_map(db: Session) -> dict:
    """一次性取出分类 id->name 映射，避免逐条查询。"""
    return {c.id: c.name for c in db.query(ProductCategory).all()}


# ---------------- 公开读 ----------------

@router.get("/api/products", summary="前台产品列表（上架）")
def public_products(
    category_id: int | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.status == 1, Product.is_activate == 1)
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    if keyword:
        q = q.filter(Product.name.contains(keyword))
    total = q.count()
    rows = (
        q.order_by(Product.sort.asc(), Product.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    cat_map = _category_map(db)
    items = [_to_product_out(r, cat_map) for r in rows]
    return paginate(items, total, page, page_size)


@router.get("/api/products/admin", summary="后台产品列表")
def admin_products(
    category_id: int | None = Query(None),
    keyword: str | None = Query(None),
    status: int | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(12, ge=1, le=100),
    _: AdminUser = Depends(require_perm("product")),
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.is_activate == 1)
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    if keyword:
        q = q.filter(Product.name.contains(keyword))
    if status is not None:
        q = q.filter(Product.status == status)
    total = q.count()
    rows = (
        q.order_by(Product.sort.asc(), Product.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    cat_map = _category_map(db)
    items = [_to_product_out(r, cat_map) for r in rows]
    return paginate(items, total, page, page_size)


@router.get("/api/products/{product_id}", summary="前台产品详情")
def public_product_detail(product_id: int, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p or p.status != 1 or p.is_activate != 1:
        raise HTTPException(status_code=404, detail="产品不存在或已下架")
    cat_map = _category_map(db)
    return success(_to_product_out(p, cat_map))


# ---------------- 后台管理 ----------------
@router.post("/api/products", summary="新增产品")
def create_product(
    body: ProductCreate,
    current: AdminUser = Depends(require_perm("product")),
    db: Session = Depends(get_db),
):
    if body.category_id is not None and not db.get(ProductCategory, body.category_id):
        raise HTTPException(status_code=400, detail="分类不存在")
    product = Product(
        category_id=body.category_id,
        name=body.name,
        series=body.series,
        code=body.code,
        reference_price=body.reference_price,
        cover_image=body.cover_image,
        gallery=dumps_json(body.gallery),
        description=clean_html(body.description),
        specs=body.specs,
        is_recommended=body.is_recommended,
        sort=body.sort,
        status=body.status,
    )
    set_audit_on_create(product, current.username)
    db.add(product)
    db.commit()
    db.refresh(product)
    return success(_to_product_out(product, _category_map(db)), msg="创建成功")


@router.put("/api/products/{product_id}", summary="编辑产品")
def update_product(
    product_id: int,
    body: ProductUpdate,
    current: AdminUser = Depends(require_perm("product")),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] is not None:
        if not db.get(ProductCategory, data["category_id"]):
            raise HTTPException(status_code=400, detail="分类不存在")
    if "gallery" in data and data["gallery"] is not None:
        data["gallery"] = dumps_json(data["gallery"])
    if "description" in data and data["description"] is not None:
        data["description"] = clean_html(data["description"])
    for k, v in data.items():
        setattr(product, k, v)
    set_audit_on_update(product, current.username)
    db.commit()
    db.refresh(product)
    return success(_to_product_out(product, _category_map(db)), msg="更新成功")


@router.delete("/api/products/{product_id}", summary="删除产品（逻辑删除）")
def delete_product(
    product_id: int,
    _: AdminUser = Depends(require_perm("product")),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
    product.is_activate = 0
    set_audit_on_update(product, "system")
    db.commit()
    return success(msg="删除成功")


@router.patch("/api/products/{product_id}/status", summary="产品上架 / 下架")
def toggle_product_status(
    product_id: int,
    body: FlagAction,
    current: AdminUser = Depends(require_perm("product")),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
    product.status = body.status if body.status is not None else (0 if product.status == 1 else 1)
    set_audit_on_update(product, current.username)
    db.commit()
    db.refresh(product)
    return success(_to_product_out(product, _category_map(db)), msg="操作成功")


@router.patch("/api/products/{product_id}/recommend", summary="首页推荐切换")
def toggle_product_recommend(
    product_id: int,
    body: FlagAction,
    current: AdminUser = Depends(require_perm("product")),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
    product.is_recommended = (
        body.status if body.status is not None else (0 if product.is_recommended == 1 else 1)
    )
    set_audit_on_update(product, current.username)
    db.commit()
    db.refresh(product)
    return success(_to_product_out(product, _category_map(db)), msg="操作成功")
