"""管理员管理路由（M2）
接口（均需 admin 权限）：
  GET    /api/admins                管理员列表
  POST   /api/admins                新增管理员
  PUT    /api/admins/{id}           编辑管理员（可重置密码）
  PATCH  /api/admins/{id}/disable    禁用 / 启用（至少保留一名启用的超级管理员）
说明：
  - 密码一律 bcrypt 哈希入库，绝不存储明文。
  - 禁用操作仅改 status（1 启用 / 0 禁用），保留 is_activate 作为逻辑删除位；
    后端 get_current_user 同时校验 status 与 is_activate，禁用即无法登录。
  - 保护规则：系统必须至少保留 1 名“启用中”的超级管理员，防止后台锁死。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Role
from app.responses import success
from app.schemas import AdminUserCreate, AdminUserOut, AdminUserUpdate
from app.security import get_current_user, hash_password, require_perm
from app.utils import loads_json, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["管理员管理"])


def _to_admin_out(user: AdminUser, db: Session) -> AdminUserOut:
    """从 ORM 管理员对象构造 Out（补充 role_code / permissions）。"""
    role = db.get(Role, user.role_id)
    perms = loads_json(role.permissions, []) if role else []
    return AdminUserOut(
        id=user.id,
        username=user.username,
        real_name=user.real_name,
        role_id=user.role_id,
        role_code=role.code if role else "",
        permissions=perms,
        status=user.status,
        is_activate=user.is_activate,
        last_login_at=user.last_login_at,
        created_date=user.created_date,
    )


@router.get("/api/admins", summary="管理员列表")
def list_admins(
    _: AdminUser = Depends(require_perm("admin")),
    db: Session = Depends(get_db),
):
    users = db.query(AdminUser).order_by(AdminUser.id).all()
    return success([_to_admin_out(u, db) for u in users])


@router.post("/api/admins", summary="新增管理员")
def create_admin(
    body: AdminUserCreate,
    current: AdminUser = Depends(require_perm("admin")),
    db: Session = Depends(get_db),
):
    if db.query(AdminUser).filter_by(username=body.username).first():
        raise HTTPException(status_code=400, detail="登录账号已存在")
    if not db.get(Role, body.role_id):
        raise HTTPException(status_code=400, detail="角色不存在")

    admin = AdminUser(
        username=body.username,
        password_hash=hash_password(body.password),
        real_name=body.real_name,
        role_id=body.role_id,
        status=body.status,
    )
    set_audit_on_create(admin, current.username)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return success(_to_admin_out(admin, db), msg="创建成功")


@router.put("/api/admins/{admin_id}", summary="编辑管理员")
def update_admin(
    admin_id: int,
    body: AdminUserUpdate,
    current: AdminUser = Depends(require_perm("admin")),
    db: Session = Depends(get_db),
):
    admin = db.get(AdminUser, admin_id)
    if not admin:
        raise HTTPException(status_code=404, detail="管理员不存在")

    data = body.model_dump(exclude_unset=True)
    # 若传入密码则重新哈希
    if "password" in data and data["password"]:
        data["password_hash"] = hash_password(data.pop("password"))
    if "role_id" in data and data["role_id"] and not db.get(Role, data["role_id"]):
        raise HTTPException(status_code=400, detail="角色不存在")

    for k, v in data.items():
        setattr(admin, k, v)
    set_audit_on_update(admin, current.username)
    db.commit()
    db.refresh(admin)
    return success(_to_admin_out(admin, db), msg="更新成功")


@router.patch("/api/admins/{admin_id}/disable", summary="禁用 / 启用管理员")
def toggle_admin(
    admin_id: int,
    current: AdminUser = Depends(require_perm("admin")),
    db: Session = Depends(get_db),
):
    admin = db.get(AdminUser, admin_id)
    if not admin:
        raise HTTPException(status_code=404, detail="管理员不存在")

    new_status = 0 if admin.status == 1 else 1

    # 保护：若将要禁用的是超级管理员，且其为唯一启用的超级管理员，则拒绝
    if new_status == 0:
        role = db.get(Role, admin.role_id)
        if role and role.code == "super_admin":
            active_super = (
                db.query(AdminUser)
                .join(Role, AdminUser.role_id == Role.id)
                .filter(Role.code == "super_admin", AdminUser.status == 1)
                .count()
            )
            if active_super <= 1:
                raise HTTPException(
                    status_code=400, detail="至少需保留一名启用的超级管理员"
                )

    admin.status = new_status
    set_audit_on_update(admin, current.username)
    db.commit()
    db.refresh(admin)
    return success(_to_admin_out(admin, db), msg="操作成功")
