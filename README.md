# 暖禾家具 · 企业家居官网

一套面向家居企业的完整官网解决方案：**前台企业官网 + 后台内容管理系统 + 后端 API**，三端解耦、单仓库交付。

- **前台**：品牌展示、产品/案例/新闻/招聘浏览、在线留言与简历投递
- **后台**：工作台 + 11 个管理模块，覆盖轮播、产品、新闻、案例、招聘、留言、站点设置与权限管理
- **后端**：FastAPI 提供 13 个业务路由，JWT + RBAC 鉴权、统一响应、富文本清洗、上传与限流

> 需求基线：`企业家居网站PRD.md` ｜ 技术方案：`暖禾-开发技术文档.md` ｜ 数据库权威源：`暖禾-数据库设计文档.md`（v1.1）｜ 设计规范：`UIUX文档.md`

---

## 技术栈

| 层 | 技术选型 |
| --- | --- |
| 后端 `api/` | Python 3.13 · FastAPI 0.110 · Uvicorn 0.29 · SQLAlchemy 2.0（2.x 声明式）· Pydantic 2.9 · SQLite · python-jose（JWT）· bcrypt · bleach（XSS 清洗） |
| 后台 `backend/` | React 18.3 · TypeScript 5.5 · Vite 5.4 · Ant Design 5.21 · React Router 6 · Zustand · Axios · Tiptap 2（富文本） |
| 前台 `frontend/` | React 18.3 · TypeScript 5.6 · Vite 5.4 · Tailwind CSS 3.4 · React Router 6 · React Hook Form + Zod · Axios |
| 部署 | Nginx 反向代理 + 静态产物；后端 Gunicorn + Uvicorn Worker |

---

## 功能概览

### 前台官网（11 个页面）

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 | 轮播、品牌介绍、产品系列、案例精选、新闻动态 |
| `/products`、`/products/:id` | 产品列表 / 详情 | 按分类筛选、系列详情与规格展示 |
| `/cases`、`/cases/:id` | 案例列表 / 详情 | 落地项目展示 |
| `/news`、`/news/:id` | 新闻列表 / 详情 | 企业动态与行业资讯 |
| `/recruitment`、`/recruitment/:id` | 招聘列表 / 详情 | 社招/校招分类、在线投递 |
| `/about/暖禾`、`/about/history`、`/about/brand` | 关于暖禾 / 发展历程 / 品牌介绍 | 二级栏目，内容由后台「关于我们内容」维护 |
| `/about/contact` | 联系我们 | 联系方式、地图、在线留言 |

### 后台管理系统（工作台 + 11 个管理模块）

| 分组 | 模块 | 能力 |
| --- | --- | --- |
| 概览 | 工作台 | 数据统计与快捷入口 |
| 内容管理 | 轮播图 | 图片、跳转链接、排序、启停 |
| 内容管理 | 关于我们内容 | 三个板块（关于暖禾 / 发展历程 / 品牌介绍）富文本维护 |
| 内容管理 | 产品分类 | 分类增删改、排序、启停 |
| 内容管理 | 产品管理 | 产品 CRUD、规格参数、详情富文本、上下架 |
| 内容管理 | 新闻管理 | 新闻 CRUD、封面、发布状态 |
| 内容管理 | 案例管理 | 案例 CRUD、封面、正文 |
| 内容管理 | 招聘管理 | 岗位 CRUD、社招/校招、任职要求 |
| 互动管理 | 留言反馈 | 留言查看、标记处理 |
| 系统设置 | 站点设置 | 站点名称、Logo、SEO、联系方式、页脚 |
| 系统设置 | 管理员管理 | 管理员 CRUD、绑定角色、启用/禁用 |
| 系统设置 | 角色管理 | 角色 CRUD、权限点配置（RBAC） |

> 另有登录页与修改密码页；首次登录（`last_login_at` 为空）会被强制跳转改密。

---

## 目录结构

```
暖禾项目/
├─ api/                          # 后端服务（FastAPI + SQLAlchemy + SQLite）
│  ├─ app/
│  │  ├─ main.py                 # 入口：CORS、静态挂载、中间件、异常处理、13 路由注册
│  │  ├─ config.py               # 配置读取（环境变量 > .env > 默认值）
│  │  ├─ db.py                   # Engine / SessionLocal / Base / get_db
│  │  ├─ models.py               # ORM 模型（11 张业务表 + 审计字段 Mixin）
│  │  ├─ schemas.py              # Pydantic 请求/响应模型
│  │  ├─ security.py             # JWT 签发校验 · bcrypt · get_current_user / require_perm
│  │  ├─ responses.py            # 统一响应 success/fail/paginate + 异常处理器
│  │  ├─ utils.py                # bleach 富文本清洗 · 招聘类型映射 · 审计人注入
│  │  ├─ seed.py                 # 基础种子：角色 / 管理员 / 站点设置 / 产品分类
│  │  ├─ seed_demo.py            # 演示业务数据（幂等，表为空时才插入）
│  │  ├─ init_db.py              # 启动钩子：建表 + 种子
│  │  └─ routers/                # 13 个路由（auth/admins/roles/banners/site_settings/
│  │                             #   about/product_categories/products/news/cases/
│  │                             #   recruitments/messages/upload）
│  ├─ static/
│  │  ├─ seed/                   # 演示用 SVG 占位图
│  │  └─ uploads/                # 后台上传文件（运行时自动创建）
│  ├─ init.sql                   # 权威 DDL（11 张业务表 + schema_version）
│  ├─ requirements.txt           # 锁定版本，兼容 Python 3.13
│  ├─ .env                       # 环境变量（已 git 忽略）
│  └─ app.db                     # SQLite 数据库（运行时生成）
├─ backend/                      # 后台管理系统
│  └─ src/
│     ├─ pages/                  # 14 个页面（登录/改密/工作台 + 11 个管理模块）
│     ├─ components/             # AppLayout · ProtectedRoute · 菜单配置 · 业务组件
│     ├─ lib/                    # Axios 封装 · 权限常量 · 工具函数
│     └─ store/                  # Zustand 登录态与全局状态
├─ frontend/                     # 前台企业官网
│  └─ src/
│     ├─ pages/                  # 11 个页面
│     ├─ components/             # Header · Footer · 卡片 · 表单等
│     ├─ lib/                    # 接口封装与工具
│     └─ data/                   # 静态兜底数据
├─ 暖禾_ppt/                     # 成果展示 PPT（slidep DSL 源文件 + 导出 PPTX）
├─ 暖禾家具项目交付包/            # 交付副本（api / backend / frontend / docs + PPTX）
├─ start.bat / stop.bat          # Windows 一键启停脚本
└─ *.md / *.html / *.svg         # PRD、技术、数据库、测试文档与高保真原型
```

---

## 快速开始

### 方式一：一键启停（Windows，推荐）

双击项目根目录的 **`start.bat`**，脚本会：

1. 自动定位本项目使用的 Node（`22.22.2-6`）与 Python 虚拟环境，找不到时回退到其他版本或 `PATH`
2. 校验目录完整性（`api/app/main.py`、前后端 `node_modules/vite`）
3. 依次在**独立窗口**启动三个服务，并跳过已被占用的端口

停止服务：双击 **`stop.bat`**（按端口 8000 / 5173 / 5174 结束进程）。

启动后访问：

| 服务 | 地址 |
| --- | --- |
| 前台官网 | http://127.0.0.1:5173 |
| 后台管理 | http://127.0.0.1:5174 |
| 接口文档（Swagger） | http://127.0.0.1:8000/docs |
| 健康检查 | http://127.0.0.1:8000/api/health |

> `start.bat` 与 `stop.bat` 以 **GBK + CRLF** 编码保存，请勿用会改写编码的编辑器保存，否则中文提示会乱码、脚本可能无法执行。

### 方式二：手动启动（跨平台）

```bash
# 1) 后端（先启动）
cd api
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2) 后台管理
cd backend
npm install
npm run dev            # http://127.0.0.1:5174

# 3) 前台官网
cd frontend
npm install
npm run dev -- --port 5173    # http://127.0.0.1:5173
```

> 前端 `vite.config.ts` 里配置的开发端口是 3000（前台）/ 3001（后台），`start.bat` 用 `--port` 覆盖为 5173 / 5174。若直接用 `npm run dev`，前台会跑在 3000，注意区分。
>
> 前后端通过 Vite 代理转发 `/api` 与 `/static` 到 `http://127.0.0.1:8000`，开发期无需处理跨域。**请勿用 `file://` 打开页面**，否则代理失效、接口全部 404。

---

## 默认账号

| 项 | 值 |
| --- | --- |
| 初始管理员 | `admin` / `admin123` |
| 首次登录 | 强制跳转修改密码（依据 `last_login_at` 是否为空判断） |
| 内置角色 | `super_admin`（全部权限）· `editor`（内容编辑）· `operator`（互动处理） |

> 当前开发库中的管理员密码已由使用者修改过，若遗忘可参考文末「常见问题 · 重置后台密码」。

---

## 配置项（`api/.env`）

所有配置遵循 **系统环境变量 > `.env` > 代码默认值**，可零配置启动。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_PATH` | `api/app.db` | SQLite 数据库文件路径 |
| `JWT_SECRET` | `change_me_in_prod` | JWT 签名密钥，**生产必须替换** |
| `JWT_EXPIRE_MINUTES` | `120` | Token 有效期（分钟） |
| `UPLOAD_DIR` | `api/static/uploads` | 上传目录；其父目录挂载为 `/static` |
| `CORS_ORIGINS` | `http://127.0.0.1:5173,http://127.0.0.1:5174` | 允许跨域来源，逗号分隔 |

> `.env` 每行只写一个 `KEY=VALUE`，注释单独成行。仓库中的 `.env` 为开发示例，已被 `.gitignore` 排除。
>
> 注意：仓库内 `api/.env` 当前把 `CORS_ORIGINS` 写成了 `3000,3001`（Vite 配置默认端口）。开发时前端走 Vite 代理属于同源请求，不受影响；若改为直连后端，需把这里改成实际访问端口（如 `5173/5174`）。

---

## 数据库

- **引擎**：SQLite（零运维），文件 `api/app.db`
- **建表**：首次启动自动执行 `init.sql`，创建 11 张业务表 + `schema_version`
- **基础种子**：`app/seed.py` 写入 3 个角色、默认管理员、站点设置、7 个示例产品分类
- **演示数据**：`python -m app.seed_demo`（在 `api/` 下执行），**幂等**——仅当对应表为空时插入，不会覆盖已有数据

当前示例库数据量（截至本 README）：

| 表 | 条数 | 表 | 条数 |
| --- | --- | --- | --- |
| `product` | 7 | `news` | 6 |
| `product_category` | 7 | `case` | 4 |
| `banner` | 3 | `recruitment` | 6 |
| `about_content` | 2 | `message` | 7 |
| `role` | 3 | `admin_user` | 1 |
| `site_setting` | 1 | | |

**备份与重置**

```bash
# 备份（建议每次改数据前执行）
cp api/app.db api/app.db.bak-$(date +%Y%m%d-%H%M%S)

# 重置：删除数据库后重启后端，会自动重新建表并写入基础种子
cd api && rm app.db && python -m uvicorn app.main:app --port 8000
```

---

## 接口约定

- **统一响应**：成功 `{"code":0,"data":...,"msg":"ok"}`；失败 `{"code":<非零>,"msg":"..."}`
- **分页结构**：分页接口的 `data` 为 `{"list":[...],"total":n,"page":1,"page_size":10}`
- **鉴权**：后台接口需 `Authorization: Bearer <JWT>`，并按角色权限点做 RBAC 校验，越权返回 403
- **公开接口**：前台读接口（产品/新闻/案例/招聘/关于/站点设置）与留言提交无需 Token
- **错误码**：401 未登录/Token 失效 · 403 无权限 · 404 不存在 · 422 参数校验失败 · 429 提交过于频繁 · 500 服务异常

完整接口清单与在线调试：http://127.0.0.1:8000/docs

---

## 关键实现约定

- **逻辑删除**：内容表删除置 `is_activate=0`，不做物理删除；默认查询仅返回 `is_activate=1`
- **双字段语义**：`is_activate`（逻辑删除）与 `status` / `publish_status`（业务启停 / 上下架）并存，互不替代
- **审计字段**：`created_at` / `updated_at` 存**操作人**，`created_date` / `updated_date` 存**时间**
- **富文本安全**：入库前经 bleach 白名单清洗（防 XSS），前端以 `dangerouslySetInnerHTML` 渲染已清洗内容
- **招聘类型**：库内存 INTEGER（1 社会招聘 / 2 校园招聘），接口附带 `type_label` 中文
- **提交防刷**：留言 / 预约 / 简历投递，同一 IP + 手机号 60 秒内仅允许 1 次，超限返回 429
- **上传校验**：`POST /api/upload` 仅接受 `jpg` / `png` / `webp`，单文件 ≤ 5MB

---

## 生产构建与部署

```bash
# 后端：Gunicorn + Uvicorn Worker
cd api && gunicorn -k uvicorn.workers.UvicornWorker -w 4 app.main:app

# 后台 / 前台：静态产物输出到各自 dist/
cd backend  && npm run build      # tsc --noEmit 类型检查 + vite build
cd frontend && npm run build
```

Nginx 反向代理参考：

```nginx
server {
  listen 80;
  server_name nuanhe.example.com;

  location /api/    { proxy_pass http://127.0.0.1:8000/; }
  location /static/ { proxy_pass http://127.0.0.1:8000/static/; }

  location /admin/  { alias /var/www/nuanhe/backend/dist/; try_files $uri $uri/ /admin/index.html; }
  location /        { root  /var/www/nuanhe/frontend/dist; try_files $uri $uri/ /index.html; }
}
```

> 生产环境务必：修改 `JWT_SECRET`、关闭 Swagger 公开访问、使用 HTTPS、为 `app.db` 配置定期备份。

---

## 项目文档

| 文档 | 内容 |
| --- | --- |
| `企业家居网站PRD.md` | 需求基线：功能范围、角色权限、信息架构、接口清单、非功能指标 |
| `UIUX文档.md` | 设计令牌、导航结构、响应式断点、后台 App Shell |
| `暖禾-开发技术文档.md` | 技术栈、目录规划、API 细化、构建与部署 |
| `暖禾-数据库设计文档.md` | 数据库权威源：11 张业务表、审计字段、DDL、索引（v1.1） |
| `暖禾-项目开发实施方案.md` | 实施总纲与 M1~M5 里程碑 |
| `暖禾-系统测试报告.md` | 功能 / 兼容 / 性能测试与缺陷记录（含 M5 实际执行记录） |
| `暖禾-er-diagram.svg` | ER 图 |
| `暖禾-home-prototype.html`、`暖禾-frontend-prototype.html`、`暖禾-backend-prototype.html` | 高保真原型 |
| `暖禾_ppt/暖禾家具项目成果展示.pptx` | 项目成果展示 PPT |

---

## 常见问题

**1. 双击 `start.bat` 闪退或中文乱码**
脚本为 GBK 编码，若被编辑器另存为 UTF-8 会出现乱码；另外请确认文件位于项目根目录、`api/app/main.py` 与前后端 `node_modules` 均存在。

**2. 端口被占用**
`stop.bat` 会结束占用 8000 / 5173 / 5174 的进程；也可手动改端口，同时记得同步前端 `vite.config.ts` 的代理目标。

**3. 前端页面能开，但接口报 404 或跨域**
必须通过 Vite 开发服务器访问（`http://127.0.0.1:5173`），不要直接打开 HTML 文件；确认后端 8000 已启动。

**4. 首次启动报依赖安装失败（Python 3.13）**
`requirements.txt` 已针对 3.13 锁定 `sqlalchemy==2.0.36`、`pydantic==2.9.2`（提供 cp313 预编译 wheel）。请勿擅自降级到旧版本，否则会触发 Rust 源码编译。

**5. 后台上传的图片在前台不显示**
确认图片路径为 `/static/uploads/...`，且后端已挂载 `/static`；Vite 代理需包含 `/static` 规则。

**6. 重置后台密码**

```bash
cd api
python -c "import sqlite3,bcrypt,datetime; h=bcrypt.hashpw(b'newpass',bcrypt.gensalt()).decode(); c=sqlite3.connect('app.db'); c.execute('update admin_user set password_hash=?, last_login_at=? where username=?',(h,datetime.datetime.now().isoformat(sep=' '),'admin')); c.commit(); print('已重置 admin 密码')"
```

> 同时写入 `last_login_at` 可跳过首次登录强制改密流程。

---

## 仓库

- GitHub：https://github.com/Czx11223/nuanhe-project
- 分支：`main`
- 已忽略：`node_modules/`、`dist/`、`__pycache__/`、`api/.env`、`*.log`、`.workbuddy/`、`xm01/`
- 注意：`api/app.db` 及其备份目前**仍在版本库中**，其中包含管理员密码哈希与业务数据。若后续要公开发布仓库，建议先加入 `.gitignore`（`api/app.db*`）并用 `git rm --cached` 移出索引。
