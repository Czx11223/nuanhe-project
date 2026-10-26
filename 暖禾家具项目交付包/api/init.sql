-- ============================================================================
-- 暖禾家具 数据库初始化脚本（权威源：数据库设计文档 v1.1 第 4 章）
-- 引擎：SQLite。本文件为 api/ 建表的唯一数据源，模型层 models.py 与之严格对应。
-- 说明：v1.1 在 11 张业务表尾部统一新增审计字段
--       (is_activate / created_at[创建人] / created_date[创建时间] /
--        updated_at[修改人] / updated_date[修改时间])；
--       原有的 created_at/updated_at 时间戳已重命名为 created_date/updated_date。
-- ============================================================================

-- ============ 权限与账户 ============

-- 角色表：super_admin(全部) / editor(内容) / operator(运营)
CREATE TABLE role (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,                       -- 角色名（中文，如 超级管理员）
    code         TEXT    NOT NULL UNIQUE,                -- 角色代码：super_admin / editor / operator
    permissions  TEXT    NOT NULL DEFAULT '[]',          -- 权限键 JSON 数组，["*"] 表示全部
    description  TEXT,                                   -- 角色说明
    is_activate  INTEGER NOT NULL DEFAULT 1,             -- 1 激活 / 0 禁用（逻辑删除）
    created_at   TEXT,                                   -- 创建人账号（v1.1 由时间戳改名而来）
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,     -- 创建时间
    updated_at   TEXT,                                   -- 修改人账号
    updated_date DATETIME                                -- 修改时间
);

-- 管理员表：登录账号 + bcrypt 密码哈希 + 所属角色
CREATE TABLE admin_user (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,               -- 登录账号
    password_hash TEXT    NOT NULL,                      -- bcrypt 哈希，禁止明文
    real_name     TEXT,                                  -- 真实姓名
    role_id       INTEGER NOT NULL,                      -- 所属角色（外键）
    status        INTEGER NOT NULL DEFAULT 1,            -- 1 启用 / 0 禁用
    last_login_at DATETIME,                              -- 最后登录时间
    is_activate   INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT,
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT,
    updated_date  DATETIME,
    FOREIGN KEY (role_id) REFERENCES role(id)
);

-- ============ 内容与展示 ============

-- 轮播图表
CREATE TABLE banner (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT,                                   -- 标题
    image_url    TEXT,                                   -- 图片地址
    link_url     TEXT,                                   -- 点击跳转链接
    sort         INTEGER NOT NULL DEFAULT 0,             -- 排序，升序展示
    status       INTEGER NOT NULL DEFAULT 1,             -- 1 启用 / 0 停用
    is_activate  INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT,
    updated_date DATETIME
);

-- 站点设置表：单条固定记录（CHECK id=1）
CREATE TABLE site_setting (
    id             INTEGER PRIMARY KEY CHECK (id = 1),   -- 固定为 1 的单条记录
    site_name      TEXT,                                 -- 站点名称
    logo_url       TEXT,                                 -- Logo 地址
    icp            TEXT,                                 -- 备案号
    address        TEXT,                                 -- 公司地址
    phone          TEXT,                                 -- 联系电话
    email          TEXT,                                 -- 联系邮箱
    business_hours TEXT,                                 -- 营业时间
    latitude       REAL,                                 -- 地图纬度
    longitude      REAL,                                 -- 地图经度
    seo_title      TEXT,                                 -- SEO 标题
    seo_keywords   TEXT,                                 -- SEO 关键词
    seo_description TEXT,                                -- SEO 描述
    is_activate    INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT,
    created_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT,
    updated_date   DATETIME
);

-- 关于我们内容表：about_暖禾 / history / brand 三个板块
CREATE TABLE about_content (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    section      TEXT    NOT NULL,                       -- about_暖禾 / history / brand
    title        TEXT,                                   -- 标题
    content      TEXT,                                   -- 正文（富文本 HTML）
    image_url    TEXT,                                   -- 配图
    sort         INTEGER NOT NULL DEFAULT 0,             -- 排序
    status       INTEGER NOT NULL DEFAULT 1,             -- 1 启用 / 0 停用
    is_activate  INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT,
    updated_date DATETIME
);

-- 产品分类表：支持二级（parent_id 自引用，一级为 NULL）
CREATE TABLE product_category (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,                       -- 分类名
    parent_id    INTEGER,                                -- 父分类，一级为 NULL
    sort         INTEGER NOT NULL DEFAULT 0,             -- 排序
    status       INTEGER NOT NULL DEFAULT 1,             -- 1 启用 / 0 禁用
    is_activate  INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT,
    updated_date DATETIME,
    FOREIGN KEY (parent_id) REFERENCES product_category(id)
);

-- 产品表
CREATE TABLE product (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER,                             -- 所属分类（外键，可空）
    name            TEXT    NOT NULL,                    -- 产品名称
    series          TEXT,                                -- 系列名
    code            TEXT,                                -- 货号
    reference_price REAL,                                -- 参考价
    cover_image     TEXT,                                -- 封面图
    gallery         TEXT,                                -- 多图 JSON 数组
    description     TEXT,                                -- 详细描述（富文本）
    specs           TEXT,                                -- 规格参数
    is_recommended  INTEGER NOT NULL DEFAULT 0,          -- 1 首页推荐 / 0 否
    sort            INTEGER NOT NULL DEFAULT 0,          -- 排序
    status          INTEGER NOT NULL DEFAULT 1,          -- 1 上架 / 0 下架
    is_activate     INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT,
    created_date    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT,
    updated_date    DATETIME,
    FOREIGN KEY (category_id) REFERENCES product_category(id)
);

-- 新闻资讯表（使用 publish_status 表达草稿/已发布，无 status 字段）
CREATE TABLE news (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT    NOT NULL,                     -- 标题
    category       TEXT    NOT NULL,                     -- 企业新闻 / 行业资讯
    cover_image    TEXT,                                 -- 封面图
    summary        TEXT,                                 -- 摘要
    content        TEXT,                                 -- 正文（富文本）
    author         TEXT,                                 -- 作者
    publish_status INTEGER NOT NULL DEFAULT 0,           -- 1 已发布 / 0 草稿
    published_at   DATETIME,                             -- 发布时间
    views          INTEGER NOT NULL DEFAULT 0,           -- 阅读量
    sort           INTEGER NOT NULL DEFAULT 0,           -- 排序
    is_activate    INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT,
    created_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT,
    updated_date   DATETIME
);

-- 案例展示表（注：case 是 SQLite 保留字，表名需用双引号引起来）
CREATE TABLE "case" (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,                      -- 标题
    category     TEXT,                                  -- 项目案例 / 客户案例
    cover_image  TEXT,                                  -- 封面图
    summary      TEXT,                                  -- 摘要
    content      TEXT,                                  -- 正文（富文本）
    sort         INTEGER NOT NULL DEFAULT 0,            -- 排序
    status       INTEGER NOT NULL DEFAULT 1,            -- 1 启用 / 0 停用
    is_activate  INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT,
    updated_date DATETIME
);

-- 招聘表（type：1 社会招聘 / 2 校园招聘）
CREATE TABLE recruitment (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          INTEGER NOT NULL,                     -- 1 社会招聘 / 2 校园招聘
    title         TEXT    NOT NULL,                     -- 职位名
    department    TEXT,                                 -- 部门
    location      TEXT,                                 -- 工作地点
    description   TEXT,                                 -- 岗位职责（富文本）
    requirements  TEXT,                                 -- 任职要求
    status        INTEGER NOT NULL DEFAULT 1,           -- 1 招聘中 / 0 停用
    sort          INTEGER NOT NULL DEFAULT 0,           -- 排序
    is_activate   INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT,
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT,
    updated_date  DATETIME
);

-- 留言反馈表（来源：联系我们表单 + 简历投递）
CREATE TABLE message (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,                      -- 姓名
    phone        TEXT,                                  -- 电话
    email        TEXT,                                  -- 邮箱
    type         TEXT    NOT NULL,                      -- 留言 / 预约 / 咨询 / 简历投递
    content      TEXT,                                  -- 内容
    status       INTEGER NOT NULL DEFAULT 0,            -- 0 待处理 / 1 已处理 / 2 已忽略
    reply        TEXT,                                  -- 回复内容
    handled_at   DATETIME,                              -- 处理时间
    is_activate  INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT,
    updated_date DATETIME
);

-- ============ 迁移版本表（系统表，不含审计字段） ============
CREATE TABLE schema_version (
    version    INTEGER PRIMARY KEY,                     -- 已应用的 schema 版本号
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP       -- 应用时间
);
INSERT INTO schema_version(version) VALUES (1);

-- ============================================================================
-- 索引设计（引 数据库设计文档 第 5 章）
-- 主键(id) 与唯一键(username/code) 由 SQLite 自动建索引，无需重复声明。
-- ============================================================================
CREATE INDEX idx_product_category  ON product(category_id);          -- 按分类筛选产品
CREATE INDEX idx_news_category     ON news(category);                -- 按 企业新闻/行业资讯 筛选
CREATE INDEX idx_news_publish      ON news(publish_status, published_at); -- 已发布列表按时间倒序
CREATE INDEX idx_case_status       ON "case"(status);                -- 前台仅取启用案例
CREATE INDEX idx_recruitment_type  ON recruitment(type, status);     -- 按 社会/校园 + 招聘中 筛选
CREATE INDEX idx_message_status    ON message(status);               -- 后台按处理状态筛选
CREATE INDEX idx_admin_role        ON admin_user(role_id);           -- 按角色查询管理员
