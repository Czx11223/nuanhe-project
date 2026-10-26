"""SQLAlchemy 数据模型（权威源：数据库设计文档 v1.1 第 3~4 章）
功能：定义 11 张业务表 + 1 张系统表（schema_version）的 ORM 映射。
与 init.sql 严格一一对应，字段名、类型、默认值保持一致。

关键约束（M1 强约束，已在方案中确认）：
1. 每张业务表尾部统一 5 个审计字段，通过 AuditMixin 复用：
   is_activate(逻辑删除) / created_at(TEXT 创建人) / created_date(创建时间)
   / updated_at(TEXT 修改人) / updated_date(修改时间)。
2. v1.1 中 created_at/updated_at 已被“改名”为人员字段（TEXT），
   真正的创建/修改时间是 created_date/updated_date（DATETIME）。
3. 双字段语义：is_activate=逻辑删除（1 激活/0 禁用），
   status/publish_status=业务启停/上下架，二者并存。
"""
from datetime import datetime

from sqlalchemy import (
    Integer,
    String,
    Text,
    REAL,
    DateTime,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AuditMixin:
    """审计字段混入类：为所有业务表统一定义 5 个审计/状态字段。

    使用 Mapped 注解声明，SQLAlchemy 2.0 会自动将其合并到继承类对应的表中。
    """

    # 逻辑删除标志：1 激活 / 0 禁用。查询默认过滤 is_activate=1。
    is_activate: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="逻辑删除标志：1激活/0禁用"
    )
    # 创建人账号（v1.1 中 created_at 不再是时间，而是人）
    created_at: Mapped[str | None] = mapped_column(String, comment="创建人账号")
    # 创建时间
    created_date: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, comment="创建时间"
    )
    # 修改人账号
    updated_at: Mapped[str | None] = mapped_column(String, comment="修改人账号")
    # 修改时间（仅在更新时刷新）
    updated_date: Mapped[datetime | None] = mapped_column(
        DateTime, default=None, onupdate=datetime.utcnow, comment="修改时间"
    )


# ============================ 权限与账户 ============================

class Role(Base, AuditMixin):
    """角色表：权限以 JSON 字符串存储于 permissions 字段。"""
    __tablename__ = "role"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="角色名(中文)")
    code: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True,
        comment="角色代码 super_admin/editor/operator",
    )
    # 权限键 JSON 数组，如 ["banner","product"]；["*"] 表示全部权限
    permissions: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]", comment="权限键JSON数组"
    )
    description: Mapped[str | None] = mapped_column(Text, comment="角色说明")

    # 关系：一个角色可被多名管理员引用
    admins = relationship("AdminUser", back_populates="role")


class AdminUser(Base, AuditMixin):
    """管理员表：登录账号 + bcrypt 密码哈希 + 所属角色。"""
    __tablename__ = "admin_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, comment="登录账号"
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="bcrypt哈希，禁止明文"
    )
    real_name: Mapped[str | None] = mapped_column(String(50), comment="真实姓名")
    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("role.id"), nullable=False, comment="所属角色"
    )
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1启用/0禁用"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime, comment="最后登录时间"
    )

    # 关系：反向引用角色
    role = relationship("Role", back_populates="admins")


# ============================ 内容与展示 ============================

class Banner(Base, AuditMixin):
    """轮播图表。"""
    __tablename__ = "banner"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str | None] = mapped_column(String(100), comment="标题")
    image_url: Mapped[str | None] = mapped_column(String(255), comment="图片地址")
    link_url: Mapped[str | None] = mapped_column(String(255), comment="点击跳转链接")
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序，升序展示"
    )
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1启用/0停用"
    )


class SiteSetting(Base, AuditMixin):
    """站点设置表：单条固定记录（CHECK id=1）。"""
    __tablename__ = "site_setting"
    # 约束：id 必须恒为 1，保证全站仅一条设置
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_site_setting_single"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="固定为1")
    site_name: Mapped[str | None] = mapped_column(String(100), comment="站点名称")
    logo_url: Mapped[str | None] = mapped_column(String(255), comment="Logo地址")
    icp: Mapped[str | None] = mapped_column(String(50), comment="备案号")
    address: Mapped[str | None] = mapped_column(String(255), comment="公司地址")
    phone: Mapped[str | None] = mapped_column(String(50), comment="联系电话")
    email: Mapped[str | None] = mapped_column(String(100), comment="联系邮箱")
    business_hours: Mapped[str | None] = mapped_column(String(100), comment="营业时间")
    latitude: Mapped[float | None] = mapped_column(REAL, comment="地图纬度")
    longitude: Mapped[float | None] = mapped_column(REAL, comment="地图经度")
    seo_title: Mapped[str | None] = mapped_column(String(255), comment="SEO标题")
    seo_keywords: Mapped[str | None] = mapped_column(String(255), comment="SEO关键词")
    seo_description: Mapped[str | None] = mapped_column(String(255), comment="SEO描述")


class AboutContent(Base, AuditMixin):
    """关于我们内容表：about_暖禾 / history / brand 三个板块。"""
    __tablename__ = "about_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="板块 about_暖禾/history/brand"
    )
    title: Mapped[str | None] = mapped_column(String(100), comment="标题")
    content: Mapped[str | None] = mapped_column(Text, comment="正文(富文本HTML)")
    image_url: Mapped[str | None] = mapped_column(String(255), comment="配图")
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序"
    )
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1启用/0停用"
    )


class ProductCategory(Base, AuditMixin):
    """产品分类表：支持二级分类（parent_id 自引用）。"""
    __tablename__ = "product_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="分类名")
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_category.id"), comment="父分类，一级为NULL"
    )
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序"
    )
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1启用/0禁用"
    )

    # 自引用关系：parent 指向父分类，children 为子分类集合（用于构建分类树）
    parent = relationship(
        "ProductCategory", remote_side="ProductCategory.id", backref="children"
    )


class Product(Base, AuditMixin):
    """产品表。"""
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_category.id"), comment="所属分类"
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="产品名称")
    series: Mapped[str | None] = mapped_column(String(50), comment="系列名")
    code: Mapped[str | None] = mapped_column(String(50), comment="货号")
    reference_price: Mapped[float | None] = mapped_column(REAL, comment="参考价")
    cover_image: Mapped[str | None] = mapped_column(String(255), comment="封面图")
    gallery: Mapped[str | None] = mapped_column(Text, comment="多图JSON数组")
    description: Mapped[str | None] = mapped_column(Text, comment="详细描述(富文本)")
    specs: Mapped[str | None] = mapped_column(Text, comment="规格参数")
    is_recommended: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="1首页推荐/0否"
    )
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序"
    )
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1上架/0下架"
    )

    # 反向引用：分类下包含多个产品
    category = relationship("ProductCategory", backref="products")


class News(Base, AuditMixin):
    """新闻资讯表：使用 publish_status 表达草稿/已发布（无 status 字段）。"""
    __tablename__ = "news"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="标题")
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="企业新闻/行业资讯"
    )
    cover_image: Mapped[str | None] = mapped_column(String(255), comment="封面图")
    summary: Mapped[str | None] = mapped_column(String(500), comment="摘要")
    content: Mapped[str | None] = mapped_column(Text, comment="正文(富文本)")
    author: Mapped[str | None] = mapped_column(String(50), comment="作者")
    publish_status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="1已发布/0草稿"
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime, comment="发布时间")
    views: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="阅读量"
    )
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序"
    )


class Case(Base, AuditMixin):
    """案例展示表。"""
    __tablename__ = "case"
    # case 是 SQLite 保留字，需对表名加引号（quote=True），
    # 否则生成的 SQL 中 `FROM case` 会报语法错误。
    __table_args__ = ({"quote": True},)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="标题")
    category: Mapped[str | None] = mapped_column(
        String(50), comment="项目案例/客户案例"
    )
    cover_image: Mapped[str | None] = mapped_column(String(255), comment="封面图")
    summary: Mapped[str | None] = mapped_column(String(500), comment="摘要")
    content: Mapped[str | None] = mapped_column(Text, comment="正文(富文本)")
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序"
    )
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1启用/0停用"
    )


class Recruitment(Base, AuditMixin):
    """招聘表：type 1 社会招聘 / 2 校园招聘（整数存储，前端映射中文）。"""
    __tablename__ = "recruitment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="1社会招聘/2校园招聘"
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False, comment="职位名")
    department: Mapped[str | None] = mapped_column(String(50), comment="部门")
    location: Mapped[str | None] = mapped_column(String(100), comment="工作地点")
    description: Mapped[str | None] = mapped_column(Text, comment="岗位职责(富文本)")
    requirements: Mapped[str | None] = mapped_column(Text, comment="任职要求")
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, comment="1招聘中/0停用"
    )
    sort: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="排序"
    )


class Message(Base, AuditMixin):
    """留言反馈表：来源为前台联系表单与简历投递。"""
    __tablename__ = "message"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    phone: Mapped[str | None] = mapped_column(String(30), comment="电话")
    email: Mapped[str | None] = mapped_column(String(100), comment="邮箱")
    type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="留言/预约/咨询/简历投递"
    )
    content: Mapped[str | None] = mapped_column(Text, comment="内容")
    status: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="0待处理/1已处理/2已忽略"
    )
    reply: Mapped[str | None] = mapped_column(Text, comment="回复内容")
    handled_at: Mapped[datetime | None] = mapped_column(DateTime, comment="处理时间")


# ============================ 系统表 ============================

class SchemaVersion(Base):
    """迁移版本表：记录已应用的 schema 版本（不含审计字段）。"""
    __tablename__ = "schema_version"

    version: Mapped[int] = mapped_column(Integer, primary_key=True, comment="schema版本号")
    applied_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, comment="应用时间"
    )
