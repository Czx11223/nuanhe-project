"""新闻资讯路由（M2）
接口：
  公开读： GET /api/news?category=&page=&page_size=   已发布新闻分页
           GET /api/news/{id}                         新闻详情（阅读量 +1）
  后台管： GET /api/news/admin?category=&publish_status=&keyword=&page=&page_size=  管理分页
           POST /api/news                新增（草稿，publish_status=0）
           PUT  /api/news/{id}           编辑（content 富文本清洗）
           DELETE /api/news/{id}         删除（逻辑删除）
           PATCH /api/news/{id}/publish  草稿 / 发布（发布时写入 published_at）
说明：news 表以 publish_status(1 已发布/0 草稿) 表达启停，无 status 字段（引 数据库设计文档 3.8）。
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, News
from app.responses import paginate, success
from app.schemas import NewsCreate, NewsOut, NewsUpdate
from app.security import get_current_user, require_perm
from app.utils import clean_html, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["新闻资讯"])


class PublishAction(BaseModel):
    """发布/草稿：传 publish_status 则置为该值，不传则翻转。"""
    publish_status: int | None = None


# ---------------- 公开读 ----------------

@router.get("/api/news", summary="前台新闻列表（已发布）")
def public_news(
    category: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(News).filter(News.publish_status == 1, News.is_activate == 1)
    if category:
        q = q.filter(News.category == category)
    total = q.count()
    rows = (
        q.order_by(News.published_at.desc(), News.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([NewsOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/api/news/admin", summary="后台新闻列表")
def admin_news(
    category: str | None = Query(None),
    publish_status: int | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1),
    page_size: int = Query(10, ge=1, le=100),
    _: AdminUser = Depends(require_perm("news")),
    db: Session = Depends(get_db),
):
    q = db.query(News).filter(News.is_activate == 1)
    if category:
        q = q.filter(News.category == category)
    if publish_status is not None:
        q = q.filter(News.publish_status == publish_status)
    if keyword:
        q = q.filter(News.title.contains(keyword))
    total = q.count()
    rows = (
        q.order_by(News.sort.asc(), News.id.desc())
        .offset((max(1, page) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paginate([NewsOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/api/news/{news_id}", summary="前台新闻详情（阅读量+1）")
def public_news_detail(news_id: int, db: Session = Depends(get_db)):
    news = db.get(News, news_id)
    if not news or news.publish_status != 1 or news.is_activate != 1:
        raise HTTPException(status_code=404, detail="新闻不存在或未发布")
    news.views = (news.views or 0) + 1     # 阅读量自增
    db.commit()
    return success(NewsOut.model_validate(news))


# ---------------- 后台管理 ----------------
@router.post("/api/news", summary="新增新闻（默认草稿）")
def create_news(
    body: NewsCreate,
    current: AdminUser = Depends(require_perm("news")),
    db: Session = Depends(get_db),
):
    news = News(
        title=body.title,
        category=body.category,
        cover_image=body.cover_image,
        summary=body.summary,
        content=clean_html(body.content),
        author=body.author,
        sort=body.sort,
        publish_status=0,   # 新增默认草稿，发布由 PATCH 完成
    )
    set_audit_on_create(news, current.username)
    db.add(news)
    db.commit()
    db.refresh(news)
    return success(NewsOut.model_validate(news), msg="创建成功")


@router.put("/api/news/{news_id}", summary="编辑新闻")
def update_news(
    news_id: int,
    body: NewsUpdate,
    current: AdminUser = Depends(require_perm("news")),
    db: Session = Depends(get_db),
):
    news = db.get(News, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="新闻不存在")
    data = body.model_dump(exclude_unset=True)
    if "content" in data and data["content"] is not None:
        data["content"] = clean_html(data["content"])
    for k, v in data.items():
        setattr(news, k, v)
    set_audit_on_update(news, current.username)
    db.commit()
    db.refresh(news)
    return success(NewsOut.model_validate(news), msg="更新成功")


@router.delete("/api/news/{news_id}", summary="删除新闻（逻辑删除）")
def delete_news(
    news_id: int,
    _: AdminUser = Depends(require_perm("news")),
    db: Session = Depends(get_db),
):
    news = db.get(News, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="新闻不存在")
    news.is_activate = 0
    set_audit_on_update(news, "system")
    db.commit()
    return success(msg="删除成功")


@router.patch("/api/news/{news_id}/publish", summary="新闻发布 / 转草稿")
def publish_news(
    news_id: int,
    body: PublishAction,
    current: AdminUser = Depends(require_perm("news")),
    db: Session = Depends(get_db),
):
    news = db.get(News, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="新闻不存在")
    new_status = (
        body.publish_status
        if body.publish_status is not None
        else (0 if news.publish_status == 1 else 1)
    )
    news.publish_status = new_status
    # 发布时写入发布时间；转草稿保留已发布时间便于恢复
    if new_status == 1 and not news.published_at:
        news.published_at = datetime.utcnow()
    set_audit_on_update(news, current.username)
    db.commit()
    db.refresh(news)
    return success(NewsOut.model_validate(news), msg="操作成功")
