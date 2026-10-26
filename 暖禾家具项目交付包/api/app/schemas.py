"""Pydantic 请求/响应模型（M2：数据校验与序列化）
功能：定义各业务实体的 Create / Update / Out 模型，供路由做参数校验与 ORM 序列化。
约定：
  - 所有 Out 模型 from_attributes=True，可直接 model_validate(ORM对象) 序列化。
  - JSON 字段（role.permissions、product.gallery）在库中存字符串，
    通过 field_validator(mode="before") 自动解析为 list，避免前端处理字符串。
  - recruitment.type（整数 1/2）额外提供 computed_field type_label（中文）便于前端渲染。
数据来源：数据库设计文档 v1.1 第 3 章 数据字典（字段名严格一致）。
"""
import json
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

# 基类：允许从 ORM 对象（含属性访问）直接构造
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# 鉴权相关
# ============================================================================

class LoginIn(BaseModel):
    """登录请求体。"""
    username: str = Field(..., min_length=1, description="登录账号")
    password: str = Field(..., min_length=1, description="登录密码")


class ChangePasswordIn(BaseModel):
    """修改密码请求体（首次改密或日常改密通用）。"""
    old_password: str = Field(..., description="原密码")
    new_password: str = Field(..., min_length=6, max_length=64, description="新密码(至少6位)")


class UserOut(ORMModel):
    """当前登录用户简要信息（随 token 返回）。"""
    id: int
    username: str
    real_name: Optional[str] = None
    role_id: int
    role_code: str
    permissions: list[str] = []
    status: int


class TokenResponse(ORMModel):
    """登录成功返回：访问令牌 + 用户信息 + 是否需改密。"""
    access_token: str
    user: UserOut
    must_change_password: bool = False


# ============================================================================
# 角色 role
# ============================================================================

class RoleBase(ORMModel):
    name: str = Field(..., min_length=1, max_length=50)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permissions: list[str] = []


class RoleUpdate(ORMModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None
    is_activate: Optional[int] = None


class RoleOut(RoleBase):
    id: int
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    @field_validator("permissions", mode="before", check_fields=False)
    @classmethod
    def _parse_permissions(cls, v):
        # 库中存 JSON 字符串，这里解析为 list；已是 list 则原样返回
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v if isinstance(v, list) else []


# ============================================================================
# 管理员 admin_user
# ============================================================================

class AdminUserCreate(ORMModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=6, max_length=64)
    real_name: Optional[str] = None
    role_id: int
    status: int = 1


class AdminUserUpdate(ORMModel):
    password: Optional[str] = Field(None, min_length=6, max_length=64)
    real_name: Optional[str] = None
    role_id: Optional[int] = None
    status: Optional[int] = None
    is_activate: Optional[int] = None


class AdminUserOut(ORMModel):
    id: int
    username: str
    real_name: Optional[str] = None
    role_id: int
    role_code: str = ""
    permissions: list[str] = []
    status: int
    is_activate: int
    last_login_at: Optional[datetime] = None
    created_date: Optional[datetime] = None


# ============================================================================
# 轮播图 banner
# ============================================================================

class BannerBase(ORMModel):
    title: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = Field(None, max_length=255)
    link_url: Optional[str] = Field(None, max_length=255)
    sort: int = 0
    status: int = 1


class BannerCreate(BannerBase):
    pass


class BannerUpdate(ORMModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    sort: Optional[int] = None
    status: Optional[int] = None


class BannerOut(BannerBase):
    id: int
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 站点设置 site_setting（单条 id=1）
# ============================================================================

class SiteSettingUpdate(ORMModel):
    site_name: Optional[str] = None
    logo_url: Optional[str] = None
    icp: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    business_hours: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    seo_title: Optional[str] = None
    seo_keywords: Optional[str] = None
    seo_description: Optional[str] = None


class SiteSettingOut(ORMModel):
    id: int
    site_name: Optional[str] = None
    logo_url: Optional[str] = None
    icp: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    business_hours: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    seo_title: Optional[str] = None
    seo_keywords: Optional[str] = None
    seo_description: Optional[str] = None
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 关于我们 about_content
# ============================================================================

class AboutContentBase(ORMModel):
    section: str = Field(..., min_length=1, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    content: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=255)
    sort: int = 0
    status: int = 1


class AboutContentCreate(AboutContentBase):
    pass


class AboutContentUpdate(ORMModel):
    section: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    sort: Optional[int] = None
    status: Optional[int] = None


class AboutContentOut(AboutContentBase):
    id: int
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 产品分类 product_category（树形）
# ============================================================================

class ProductCategoryBase(ORMModel):
    name: str = Field(..., min_length=1, max_length=50)
    parent_id: Optional[int] = None
    sort: int = 0
    status: int = 1


class ProductCategoryCreate(ProductCategoryBase):
    pass


class ProductCategoryUpdate(ORMModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    sort: Optional[int] = None
    status: Optional[int] = None


class ProductCategoryOut(ProductCategoryBase):
    id: int
    is_activate: int
    children: list["ProductCategoryOut"] = []   # 树形嵌套（一级分类含子分类）
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 产品 product
# ============================================================================

class ProductBase(ORMModel):
    category_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=100)
    series: Optional[str] = Field(None, max_length=50)
    code: Optional[str] = Field(None, max_length=50)
    reference_price: Optional[float] = None
    cover_image: Optional[str] = Field(None, max_length=255)
    gallery: list[str] = []        # 多图，序列化时以 JSON 字符串存库
    description: Optional[str] = None
    specs: Optional[str] = None
    is_recommended: int = 0
    sort: int = 0
    status: int = 1


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ORMModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    series: Optional[str] = None
    code: Optional[str] = None
    reference_price: Optional[float] = None
    cover_image: Optional[str] = None
    gallery: Optional[list[str]] = None
    description: Optional[str] = None
    specs: Optional[str] = None
    is_recommended: Optional[int] = None
    sort: Optional[int] = None
    status: Optional[int] = None


class ProductOut(ProductBase):
    id: int
    is_activate: int
    category_name: Optional[str] = None   # 联表方便前端展示
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    @field_validator("gallery", mode="before", check_fields=False)
    @classmethod
    def _parse_gallery(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v if isinstance(v, list) else []


# ============================================================================
# 新闻 news（使用 publish_status 而非 status）
# ============================================================================

class NewsBase(ORMModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=50)  # 企业新闻/行业资讯
    cover_image: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    author: Optional[str] = Field(None, max_length=50)
    sort: int = 0


class NewsCreate(NewsBase):
    pass


class NewsUpdate(ORMModel):
    title: Optional[str] = None
    category: Optional[str] = None
    cover_image: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    sort: Optional[int] = None


class NewsOut(NewsBase):
    id: int
    publish_status: int
    published_at: Optional[datetime] = None
    views: int
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 案例 case
# ============================================================================

class CaseBase(ORMModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    cover_image: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    sort: int = 0
    status: int = 1


class CaseCreate(CaseBase):
    pass


class CaseUpdate(ORMModel):
    title: Optional[str] = None
    category: Optional[str] = None
    cover_image: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    sort: Optional[int] = None
    status: Optional[int] = None


class CaseOut(CaseBase):
    id: int
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 招聘 recruitment（type 1 社会 / 2 校园）
# ============================================================================

class RecruitmentBase(ORMModel):
    type: int = Field(..., description="1 社会招聘 / 2 校园招聘")
    title: str = Field(..., min_length=1, max_length=100)
    department: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    requirements: Optional[str] = None
    sort: int = 0
    status: int = 1


class RecruitmentCreate(RecruitmentBase):
    pass


class RecruitmentUpdate(ORMModel):
    type: Optional[int] = None
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    sort: Optional[int] = None
    status: Optional[int] = None


class RecruitmentOut(RecruitmentBase):
    id: int
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    @computed_field
    @property
    def type_label(self) -> str:
        """根据整数 type 计算中文标签，便于前端直接渲染。"""
        return {1: "社会招聘", 2: "校园招聘"}.get(self.type, "未知")


# ============================================================================
# 留言 message
# ============================================================================

class MessageBase(ORMModel):
    name: str = Field(..., min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=100)
    type: str = Field(..., min_length=1, max_length=20)  # 留言/预约/咨询/简历投递
    content: Optional[str] = None


class MessageCreate(MessageBase):
    pass


class MessageUpdate(ORMModel):
    status: Optional[int] = None          # 0 待处理 / 1 已处理 / 2 已忽略
    reply: Optional[str] = None


class MessageOut(MessageBase):
    id: int
    status: int
    reply: Optional[str] = None
    handled_at: Optional[datetime] = None
    is_activate: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None


# ============================================================================
# 通用
# ============================================================================

class IdResponse(ORMModel):
    """通用「操作成功返回受影响 ID」响应。"""
    id: int
