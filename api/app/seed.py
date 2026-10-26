"""种子数据模块（首次初始化写入）
功能：写入 3 个角色、默认管理员(admin/admin123)、站点设置单条、7 个示例产品分类。
幂等性：每张表仅在其为空时才插入，保证服务重复启动不会重复写入或报错。

数据来源：数据库设计文档 第 6 章 种子数据。
审计字段约定：种子插入时 created_at 记为 'system'，created_date 由 ORM 默认值填充，
updated_* 初始为空；业务运行时由后端在新增/修改时自动填充当前登录账号与时间。
"""
from app.db import SessionLocal
from app.models import Role, AdminUser, SiteSetting, ProductCategory
from app.security import hash_password

# 示例一级产品分类（引 数据库设计文档 6.4）
SEED_CATEGORIES = ["胡桃禮", "如意春", "禧YUE", "柏悦", "蓝宝嘉", "办公家具", "软体"]


def seed() -> None:
    """执行种子数据写入。"""
    db = SessionLocal()
    try:
        # ---------- 1. 角色 ----------
        if db.query(Role).count() == 0:
            db.add_all([
                Role(
                    name="超级管理员",
                    code="super_admin",
                    permissions='["*"]',          # 全部权限
                    description="拥有系统全部权限",
                    created_at="system",
                ),
                Role(
                    name="内容编辑",
                    code="editor",
                    permissions='["banner","about","product_category","product","news","case","recruitment"]',
                    description="负责内容与案例编辑",
                    created_at="system",
                ),
                Role(
                    name="运营",
                    code="operator",
                    permissions='["message","site_setting"]',
                    description="负责互动与站点运营",
                    created_at="system",
                ),
            ])
            db.commit()

        # ---------- 2. 默认管理员 ----------
        if db.query(AdminUser).count() == 0:
            admin_role = db.query(Role).filter_by(code="super_admin").first()
            db.add(AdminUser(
                username="admin",
                password_hash=hash_password("admin123"),  # 首次登录应强制修改（M2 处理）
                real_name="系统管理员",
                role_id=admin_role.id,
                status=1,
                created_at="system",
            ))
            db.commit()

        # ---------- 3. 站点设置（单条 id=1） ----------
        if db.query(SiteSetting).count() == 0:
            db.add(SiteSetting(
                id=1,
                site_name="暖禾家具",
                address="广东省佛山市顺德区家具产业园",
                phone="400-888-8888",
                email="contact@暖禾.com",
                business_hours="周一至周日 09:00-18:00",
                created_at="system",
            ))
            db.commit()

        # ---------- 4. 示例产品分类（一级） ----------
        if db.query(ProductCategory).count() == 0:
            db.add_all([
                ProductCategory(name=name, sort=i, status=1, created_at="system")
                for i, name in enumerate(SEED_CATEGORIES, start=1)
            ])
            db.commit()
    finally:
        db.close()
