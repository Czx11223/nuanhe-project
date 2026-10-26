"""安全与鉴权模块（M2：JWT 鉴权 + RBAC 权限校验）
功能：
  1. 密码哈希/校验（bcrypt，M1 已提供，此处保留）。
  2. JWT（HS256）令牌生成与校验：登录成功后签发访问令牌。
  3. 依赖 get_current_user：从 Bearer 令牌解析当前登录管理员，
     校验账号 status=1 且 is_activate=1，否则 401。
  4. 依赖 require_perm(perm)：在已登录基础上校验角色权限键，
     越权或无权限返回 403；首次登录未改密也返回 403（强制先改密）。

设计说明（不改动数据库设计文档 v1.1 的表结构）：
  - 数据库 admin_user 表没有“是否需改密”字段；本模块用「last_login_at 是否为空」
    判定是否首次登录（种子管理员 last_login_at 初始为空），并在 JWT 中放入
    must_change_pwd 声明。登录时不写 last_login_at，改密成功后再写入，
    从而严格实现“首次登录强制修改初始密码”。
"""
import json
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.db import SessionLocal
from app.models import AdminUser, Role

# ----------------------------------------------------------------------------
# 一、密码哈希（bcrypt 官方库直接计算，不经由 passlib，规避版本兼容缺陷）
# ----------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """对明文密码进行 bcrypt 哈希，返回哈希串（绝不直接存储明文）。

    bcrypt 对超过 72 字节的密码会报错，因此若密码过长先按 UTF-8 截断到 72 字节。
    """
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """校验明文密码与数据库中哈希是否匹配，返回布尔值。"""
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8")[:72],
            hashed.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # 哈希格式异常时视为校验失败，避免 500
        return False


# ----------------------------------------------------------------------------
# 二、JWT 令牌
# ----------------------------------------------------------------------------

def create_access_token(user_id: int, must_change_pwd: bool = False) -> str:
    """生成 JWT 访问令牌。

    载荷字段：
      - sub：用户 ID（字符串，避免 int 在部分库中被序列化问题）
      - must_change_pwd：是否仍需修改初始密码（首次登录为 True）
      - iat / exp：签发时间与过期时间（默认 120 分钟，见 config）
    """
    now = datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "must_change_pwd": must_change_pwd,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _load_permissions(role_id: int) -> list:
    """根据角色 ID 读取权限键列表（JSON 字符串 -> list）。"""
    db = SessionLocal()
    try:
        role = db.get(Role, role_id)
        if not role:
            return []
        try:
            return json.loads(role.permissions)
        except (json.JSONDecodeError, TypeError):
            return []
    finally:
        db.close()


# ----------------------------------------------------------------------------
# 三、鉴权依赖
# ----------------------------------------------------------------------------

# HTTPBearer：从请求头 Authorization: Bearer <token> 提取令牌；
# auto_error=False 让缺失令牌时由我们自己返回 401（而非库默认的 403）。
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
) -> AdminUser:
    """解析当前登录管理员（FastAPI 依赖）。

    失败场景统一抛 401：
      - 未携带令牌 / 令牌非法 / 已过期
      - 账号被禁用（status=0）或逻辑删除（is_activate=0）
    成功时把 JWT 中的 must_change_pwd 声明挂到用户对象上，供 require_perm 读取。
    """
    if cred is None or not cred.credentials:
        raise HTTPException(status_code=401, detail="未提供认证信息，请先登录")

    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="登录已过期或令牌无效")

    db = SessionLocal()
    try:
        user = db.get(AdminUser, user_id)
    finally:
        db.close()

    if not user or user.status != 1 or user.is_activate != 1:
        raise HTTPException(status_code=401, detail="账号已被禁用或不存在")

    # 把「是否需改密」临时挂到 ORM 对象上（仅进程内使用，不落库）
    user.must_change_pwd = bool(payload.get("must_change_pwd", False))
    return user


def require_perm(perm: str):
    """RBAC 权限校验依赖工厂。

    用法：Depends(require_perm("product"))。
    逻辑：
      1. 先取得当前登录用户（含 must_change_pwd）。
      2. 若 must_change_pwd=True，强制 403（必须先改初始密码）。
      3. 读取角色权限键；包含 "*" 或目标 perm 则放行，否则 403。
    权限键约定见 开发技术文档 附录 A / 实施方案 4.2。
    """

    def _dep(user: AdminUser = Depends(get_current_user)) -> AdminUser:
        # 首次登录未改密：除“改密”接口外的一切操作都被拦截
        if getattr(user, "must_change_pwd", False):
            raise HTTPException(status_code=403, detail="请先修改初始密码后再操作")

        perms = _load_permissions(user.role_id)
        if "*" in perms or perm in perms:
            return user

        raise HTTPException(status_code=403, detail="无权限执行该操作")

    return _dep
