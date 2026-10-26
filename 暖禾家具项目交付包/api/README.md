# 暖禾家具 后端服务（api/）

基于 **FastAPI + SQLAlchemy 2.x + SQLite** 的企业家居网站后端。当前为 **M2 阶段**：鉴权/RBAC、统一响应、13 个业务路由（含前台公开读接口）、文件上传、富文本 XSS 清洗、留言限流、首次登录强制改密、Swagger 注解。

## 目录结构

```
api/
├─ app/
│  ├─ main.py          # FastAPI 入口：CORS、静态文件、中间件、异常处理器、路由注册、健康检查
│  ├─ db.py            # 引擎 / Session / Base / get_db
│  ├─ config.py        # 读取 .env（DB/JWT/上传/CORS）
│  ├─ security.py      # JWT 生成/校验 + bcrypt 哈希 + get_current_user / require_perm(RBAC)
│  ├─ models.py        # ORM 模型（对齐数据库设计文档 v1.1，含 AuditMixin）
│  ├─ schemas.py       # 所有 Pydantic 请求/响应模型（含 JSON 字段自动解析、recruitment 类型标签）
│  ├─ responses.py     # 统一响应助手 success/fail/paginate + 响应包装中间件 + 异常处理器
│  ├─ utils.py         # bleach 富文本清洗 / 招聘类型映射 / 审计人注入
│  ├─ seed.py          # 种子数据（角色/管理员/站点设置/分类）
│  ├─ init_db.py       # 启动钩子：建表 + 种子
│  └─ routers/         # 13 个路由：auth/admins/roles/banners/site_settings/about/
│                       #   product_categories/products/news/cases/recruitments/messages/upload
├─ migrations/         # 后续 schema 升级脚本（0002_*.sql…），当前为空
├─ static/uploads/     # 上传文件目录（运行时自动创建）
├─ init.sql            # 权威 DDL（数据库设计文档 v1.1 第 4 章）
├─ requirements.txt
├─ .env
└─ README.md
```

## 快速启动

```bash
# 1. 安装依赖（建议在虚拟环境）
pip install -r requirements.txt

# 2. 启动开发服务器
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

启动后：
- 接口文档 Swagger：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/health

## 数据库初始化说明

- 数据库文件默认 `api/app.db`（SQLite，零运维）。
- 服务首次启动会**自动**执行 `init.sql` 建表（含 11 张业务表 + `schema_version`），
  随后写入种子数据；已存在则跳过，可重复启动。
- 数据库权威源为 `暖禾-数据库设计文档.md` v1.1：每业务表统一 5 审计字段，
  `created_at/updated_at` 为创建人/修改人（TEXT），`created_date/updated_date` 为时间。

## 阶段进度

| 阶段 | 状态 |
| --- | --- |
| M1 脚手架 + 数据库 | ✅ 完成 |
| M2 鉴权/RBAC/基础 CRUD | ✅ 完成 |
| M3 后台 11 模块 | ✅ 完成（`backend/`） |
| M4 前台接入 | ✅ 完成（`frontend/`） |
| M5 联调交付 | ✅ 完成（38/38 接口级用例通过 + RBAC/安全补测通过） |

## M1 环境适配说明（Python 3.13 下的版本微调，便于人工审核）

本机使用 WorkBuddy 托管的 Python 3.13.12。开发技术文档 2.2 的原始版本锁定在
该环境下存在构建/运行问题，已做如下最小必要调整（功能不受影响）：

| 依赖 | 原锁定 | 实际安装 | 调整原因 |
| --- | --- | --- | --- |
| pydantic | 2.6.4 | 2.9.2 | 其依赖的 pydantic-core 2.16.3 无 cp313 预编译 wheel，会触发 Rust 源码编译并因缺 MSVC 链接器失败 |
| sqlalchemy | 2.0.29 | 2.0.36 | 2.0.29 在 Python 3.13 下因 `TypingOnly` 断言失败（早于 3.13 支持） |
| passlib[bcrypt] | 1.7.4 | 改用官方 bcrypt 5.0.0 | passlib 1.7.4 与 bcrypt 4+ 不兼容（`detect_wrap_bug` 传超长测试串报错），改为直接用 bcrypt 接口哈希 |

> 若迁移到已提供对应预编译 wheel 的 Python 版本（如 3.11/3.12），可按技术文档原锁定版本安装。

其他实现要点：
- `case` 是 SQLite 保留字，已在 `init.sql` 与 `models.py`（`quote=True`）中对表名加双引号。
- `.env` 注释需单独成行，值后不要追加 `#` 注释（自写解析器不处理行内注释）。

## M2 接口契约与实现要点（供前后台联调）

### 统一响应
- 成功：`{"code":0,"data":<任意>,"msg":"ok"}`；分页：`{"code":0,"data":{"list":[...],"total":N,"page":p,"page_size":s},"msg":"ok"}`。
- 失败：`{"code":<非零>,"msg":"<描述>"}`，错误码 401/403/422/404/400/429/500（见开发技术文档 6.4）。
- 由 `responses.py` 的 `response_wrapper` 中间件对 JSON 响应自动包装；静态文件(StreamingResponse)直接透传。

### 鉴权与 RBAC
- 登录 `POST /api/auth/login` → 返回 `{access_token, user, must_change_password}`。
- 默认管理员 `admin/admin123` **首次登录** `must_change_password=true`，未改密前任何需权操作返回 403；
  `POST /api/auth/change-password` 改密后写入 `last_login_at` 并重新签发无强制改密令牌。
- 后台接口经 `require_perm(<权限键>)` 校验：权限键 `*`(全部)/`banner`/`about`/`product_category`/`product`/`news`/`case`/`recruitment`/`message`/`site_setting`/`admin`/`role`。
- 审计字段：`created_at/updated_at` 为人员（当前登录账号），由 `utils.set_audit_on_create/update` 写入；`created_date/updated_date` 由 ORM 默认值/自动刷新。

### 关键约束
- **逻辑删除**：内容表（banner/about/product_category/product/news/case/recruitment/）删除统一置 `is_activate=0`，不物理删除；查询默认过滤 `is_activate=1`。
- **双字段语义**：`is_activate`=逻辑删除，`status`/`publish_status`=业务启停/上下架（与数据库设计文档 v1.1 一致）。
- **招聘类型**：`recruitment.type` 存整数(1 社会/2 校园)，响应额外返回 `type_label` 中文；前台按整数查询。
- **案例置顶**：case 表无独立置顶字段，用 `sort` 置为最小值-1 实现（不扩展权威表结构）。
- **富文本 XSS**：入库前 `bleach` 白名单清洗（`p/br/b/i/.../a/img`，属性 `href/src/alt/class`）。
- **上传**：`POST /api/upload`（需登录）校验 `image/jpeg|png|webp` 且 ≤5MB，返回 `{url:"/static/uploads/xxx"}`。
- **留言限流**：`POST /api/messages`（公开）按「IP+手机号」60s 内仅 1 次，超出返回 429。

## M5 联调补充说明（供人工审核）

- **分页契约调整**：全部 8 处分页接口 `page_size` 上限由 `le=50` 放宽至 `le=100`（对齐前端「一次取全量做客户端筛选」的调用方式）；`page<=0` 不再报 422，统一兜底为第 1 页（对齐测试报告 BUG-010 修复约定，`responses.paginate` 与路由 offset 均做 `max(1,page)`）。
- **静态挂载调整**：`/static` 从仅挂载 `static/uploads/` 改为挂载整个 `static/` 目录（上传文件与 `static/seed/` 演示占位图均可访问）。
- **演示数据**：`python -m app.seed_demo` 可幂等填充轮播/产品/新闻/案例/招聘/关于/留言演示数据（含 36 张蓝调 SVG 占位图），不影响基础种子。
- **M5 实际执行**：接口级用例 38/38 通过（前台公开读、登录/改密/鉴权、后台 CRUD、XSS 清洗、留言闭环+限流、上传校验、分页兜底、404），RBAC 越权补测通过（editor 调 `/api/admins`=403、调 `/api/banners/admin`=200），详见 `暖禾-系统测试报告.md` §8。
