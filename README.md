# 暖禾家具 企业家居网站

基于 **FastAPI + React + Ant Design** 的企业家居官网项目：前台展示官网（`frontend/`）+ 后台管理系统（`backend/`）+ 后端服务（`api/`），三目录解耦、单仓库交付。

> 技术基线：`暖禾-开发技术文档.md`；数据库权威源：`暖禾-数据库设计文档.md`（v1.1）；需求：`企业家居网站PRD.md`；设计：`UIUX文档.md`。

## 目录结构

```
暖禾/
├─ api/        # 后端服务：FastAPI + SQLAlchemy 2.x + SQLite（唯一后端，含 Swagger /docs）
├─ backend/    # 后台管理系统：React18 + TS + Ant Design 5（11 个管理模块）
├─ frontend/   # 前台企业官网：React18 + TS + Tailwind（5 主导航 + 二级栏目）
└─ *.md / *.html / *.svg   # 需求、设计、技术、数据库、测试文档与原型
```

## 端口与默认账号

| 项 | 值 |
| --- | --- |
| 前台官网（开发） | http://127.0.0.1:5173 |
| 后台管理（开发） | http://127.0.0.1:5174 |
| 后端 API + Swagger | http://127.0.0.1:8000（接口文档 `/docs`） |
| 默认管理员 | `admin / admin123`（**首次登录强制修改密码**） |
| 内置角色 | super_admin（全部权限）/ editor / operator |

## 快速启动（开发模式）

> 依次启动：先后端，再前后台（前后台通过 Vite 代理访问后端 `/api` 与 `/static`）。

### 1. 后端 api/

```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- 首次启动自动建库（`init.sql`，11 张业务表 + `schema_version`）并写入基础种子（角色/默认管理员/站点设置/产品分类）。
- 可选：填充演示业务数据（轮播/产品/新闻/案例/招聘/关于/留言 + 蓝调 SVG 占位图）：

```bash
python -m app.seed_demo
```

### 2. 后台管理系统 backend/

```bash
cd backend
npm install
npm run dev        # http://127.0.0.1:5174
```

### 3. 前台官网 frontend/

```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173
```

## 生产构建与部署

```bash
# 后端：Gunicorn + Uvicorn worker（生产）
cd api && gunicorn -k uvicorn.workers.UvicornWorker -w 4 app.main:app

# 前后台：静态产物 dist/
cd backend  && npm run build   # tsc 类型检查 + vite 打包
cd frontend && npm run build
```

### Nginx 反代建议（引 开发技术文档 8.3）

```nginx
server {
  listen 80;
  server_name 暖禾.example;
  location /api/      { proxy_pass http://127.0.0.1:8000/; }
  location /static/   { proxy_pass http://127.0.0.1:8000/static/; }
  location /admin/    { root /var/www/backend/dist; try_files $uri /index.html; }
  location /          { root /var/www/frontend/dist; try_files $uri /index.html; }
}
```

## 接口与契约

- 所有接口统一响应：成功 `{code:0, data, msg:"ok"}`；失败 `{code:<非零>, msg}`；分页 `{list,total,page,page_size}`。
- 前台公开读接口无需 Token；后台接口需 `Authorization: Bearer <JWT>`，并按角色 RBAC 校验（越权 403）。
- 完整接口清单见 Swagger：http://127.0.0.1:8000/docs

## 关键实现约定（引 数据库设计文档 v1.1）

- **逻辑删除**：内容表删除置 `is_activate=0`，不物理删除；查询默认过滤 `is_activate=1`。
- **双字段语义**：`is_activate`（逻辑删除）与 `status`/`publish_status`（业务启停/上下架）并存。
- **审计字段**：`created_at/updated_at` 为人员（创建人/修改人），`created_date/updated_date` 为时间。
- **富文本安全**：内容入库前 bleach 白名单清洗（防 XSS），前端 `dangerouslySetInnerHTML` 渲染已清洗 HTML。
- **招聘类型**：库内 INTEGER（1 社会 / 2 校园），接口额外返回 `type_label` 中文。
- **提交防刷**：留言/预约/简历投递同一 IP+手机号 60s 内仅 1 次（429）。
- **上传校验**：`POST /api/upload` 仅接受 jpg/png/webp 且 ≤5MB。

## 系统测试

完整功能/兼容/性能/缺陷记录见 `暖禾-系统测试报告.md`（M5 阶段已追加实际执行记录）。

## 项目文档

| 文档 | 说明 |
| --- | --- |
| `企业家居网站PRD.md` | 需求基线（功能范围 / 角色权限 / 信息架构 / 接口 / 非功能） |
| `UIUX文档.md` | 设计令牌 / 导航 / 断点 / 后台 App Shell |
| `暖禾-开发技术文档.md` | 技术栈 / 目录 / API 细化 / 构建部署 |
| `暖禾-数据库设计文档.md` | 数据库权威源（11 业务表 + 审计字段 + DDL + 索引） |
| `暖禾-项目开发实施方案.md` | 实施总纲（M1~M5 里程碑） |
| `暖禾-系统测试报告.md` | 系统测试报告（含 M5 实际执行记录） |
