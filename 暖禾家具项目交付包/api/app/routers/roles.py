"""角色管理路由（M2）
接口（均需 role 权限）：
  GET    /api/roles              角色列表（含停用）
  POST   /api/roles              新增角色
  PUT    /api/roles/{id}         编辑角色
  DELETE /api/roles/{id}         删除角色（super_admin 角色受保护不可删）
说明：
  - 权限键以 JSON 字符串存库（role.permissions），接口层用 list 收发明。
  - super_admin 为系统内置最高角色，前端/后台均不可删除（防止锁死后台）。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminUser, Role
from app.responses import success
from app.schemas import RoleCreate, RoleOut, RoleUpdate
from app.security import get_current_user, require_perm
from app.utils import dumps_json, set_audit_on_create, set_audit_on_update

router = APIRouter(tags=["角色管理"])


@router.get("/api/roles", summary="角色列表")
def list_roles(
    _: AdminUser = Depends(require_perm("role")),
    db: Session = Depends(get_db),
):
    roles = db.query(Role).order_by(Role.id).all()
    return success([RoleOut.model_validate(r) for r in roles])


@router.post("/api/roles", summary="新增角色")
def create_role(
    body: RoleCreate,
    current: AdminUser = Depends(require_perm("role")),
    db: Session = Depends(get_db),
):
    # 角色代码唯一性校验
    if db.query(Role).filter_by(code=body.code).first():
        raise HTTPException(status_code=400, detail="角色代码已存在")
    role = Role(
        name=body.name,
        code=body.code,
        description=body.description,
        permissions=dumps_json(body.permissions),
    )
    set_audit_on_create(role, current.username)
    db.add(role)
    db.commit()
    db.refresh(role)
    return success(RoleOut.model_validate(role), msg="创建成功")


@router.put("/api/roles/{role_id}", summary="编辑角色")
def update_role(
    role_id: int,
    body: RoleUpdate,
    current: AdminUser = Depends(require_perm("role")),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    data = body.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != role.code:
        if db.query(Role).filter_by(code=data["code"]).first():
            raise HTTPException(status_code=400, detail="角色代码已存在")
    if "permissions" in data:
        data["permissions"] = dumps_json(data["permissions"])
    for k, v in data.items():
        setattr(role, k, v)
    set_audit_on_update(role, current.username)
    db.commit()
    db.refresh(role)
    return success(RoleOut.model_validate(role), msg="更新成功")


@router.delete("/api/roles/{role_id}", summary="删除角色（super_admin 受保护）")
def delete_role(
    role_id: int,
    _: AdminUser = Depends(require_perm("role")),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    # 系统内置最高角色不可删除，防止后台锁死
    if role.code == "super_admin":
        raise HTTPException(status_code=400, detail="内置超级管理员角色不可删除")
    # 禁止删除仍被管理员引用的角色
    if db.query(AdminUser).filter_by(role_id=role_id).first():
        raise HTTPException(status_code=400, detail="该角色下仍有管理员，无法删除")
    db.delete(role)
    db.commit()
    return success(msg="删除成功")
