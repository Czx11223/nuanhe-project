"""站点设置路由（M2）
接口：
  公开读： GET /api/site-settings            单条站点设置（前台“联系我们”等读取）
  后台管： GET /api/site-settings/admin      读取（需 site_setting 权限）
           PUT /api/site-settings            更新单条（固定 id=1）
说明：站点设置为全站唯一记录（CHECK id=1），不存在时 PUT 自动创建。
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, SiteSetting
from app.responses import success
from app.schemas import SiteSettingOut, SiteSettingUpdate
from app.security import get_current_user, require_perm
from app.utils import set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["站点设置"])


@router.get("/api/site-settings", summary="前台站点设置")
def public_site_settings(db: Session = Depends(get_db)):
    setting = db.get(SiteSetting, 1)
    if not setting:
        return success(None)
    return success(SiteSettingOut.model_validate(setting))


@router.get("/api/site-settings/admin", summary="后台读取站点设置")
def admin_site_settings(
    _: AdminUser = Depends(require_perm("site_setting")),
    db: Session = Depends(get_db),
):
    setting = db.get(SiteSetting, 1)
    if not setting:
        return success(None)
    return success(SiteSettingOut.model_validate(setting))


@router.put("/api/site-settings", summary="更新站点设置（单条）")
def update_site_settings(
    body: SiteSettingUpdate,
    current: AdminUser = Depends(require_perm("site_setting")),
    db: Session = Depends(get_db),
):
    setting = db.get(SiteSetting, 1)
    if not setting:
        # 不存在则自动创建（保证 id 恒为 1）
        setting = SiteSetting(id=1)
        set_audit_on_create(setting, current.username)
        db.add(setting)

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(setting, k, v)
    set_audit_on_update(setting, current.username)
    db.commit()
    db.refresh(setting)
    return success(SiteSettingOut.model_validate(setting), msg="保存成功")
