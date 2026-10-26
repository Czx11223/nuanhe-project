"""鉴权路由（M2）
功能：管理员登录、修改密码（含首次登录强制改密）、获取当前登录用户。
接口：
  POST /api/auth/login          公开
  POST /api/auth/change-password 需登录（任何已登录用户可改自己的密码）
  GET  /api/auth/me             需登录
设计要点：
  - 首次登录判定：admin_user.last_login_at 为空视为未改密，登录时下发
    must_change_password=True；改密成功后才写入 last_login_at 并重新签发无强制改密令牌。
  - 不新增数据库字段，严格遵循 数据库设计文档 v1.1 表结构。
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Role
from app.responses import success
from app.schemas import ChangePasswordIn, LoginIn, UserOut
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.utils import loads_json

router = APIRouter(tags=["鉴权"])


@router.post("/api/auth/login", summary="管理员登录")
def login(body: LoginIn, db: Session = Depends(get_db)):
    """校验账号密码，成功返回 JWT 与用户信息。

    失败统一返回 401（账号或密码错误 / 账号被禁用），避免泄露具体原因。
    """
    user = db.query(AdminUser).filter_by(username=body.username).first()
    # 统一错误提示，防止账号枚举
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    if user.status != 1 or user.is_activate != 1:
        raise HTTPException(status_code=401, detail="账号已被禁用或不存在")

    # 首次登录判定：从未登录过（last_login_at 为空）则需强制改密
    must_change = user.last_login_at is None

    token = create_access_token(user.id, must_change_pwd=must_change)

    role = db.get(Role, user.role_id)
    perms = loads_json(role.permissions, []) if role else []
    user_out = UserOut(
        id=user.id,
        username=user.username,
        real_name=user.real_name,
        role_id=user.role_id,
        role_code=role.code if role else "",
        permissions=perms,
        status=user.status,
    )
    # 统一响应结构：{code:0, data:{access_token,user,must_change_password}, msg}
    # 直接返回 dict（success 内为 TokenResponse 的字段），由响应中间件保证契约一致。
    return success({
        "access_token": token,
        "user": user_out.model_dump(),
        "must_change_password": must_change,
    })


@router.post("/api/auth/change-password", summary="修改密码（首次登录强制 / 日常）")
def change_password(
    body: ChangePasswordIn,
    current: AdminUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改当前登录用户的密码。

    校验原密码 -> 更新哈希 -> 写入 last_login_at（标志已完成首次登录） ->
    以新令牌重新签发（must_change_pwd=False）。
    该接口只依赖 get_current_user（不要求具体权限），保证首次登录用户也能改密。
    """
    # 重新取会话内实例，避免 get_current_user 返回的分离实例提交失败
    db_user = db.get(AdminUser, current.id)
    if not verify_password(body.old_password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")

    db_user.password_hash = hash_password(body.new_password)
    db_user.last_login_at = datetime.utcnow()   # 改密即视为完成首次登录
    db_user.updated_at = db_user.username        # 修改人=自己
    db.commit()

    # 重新签发无强制改密令牌，前端可无缝续用
    new_token = create_access_token(db_user.id, must_change_pwd=False)
    return success({"access_token": new_token}, msg="密码修改成功")


@router.get("/api/auth/me", summary="获取当前登录用户信息")
def me(current: AdminUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """返回当前登录管理员及其角色权限，供前端初始化菜单/按钮权限。"""
    role = db.get(Role, current.role_id)
    perms = loads_json(role.permissions, []) if role else []
    user_out = UserOut(
        id=current.id,
        username=current.username,
        real_name=current.real_name,
        role_id=current.role_id,
        role_code=role.code if role else "",
        permissions=perms,
        status=current.status,
    )
    return success(user_out)
