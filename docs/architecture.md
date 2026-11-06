# 现行架构

> 唯一现行架构说明。历史方案（阿里云 FC + NAS、前后端各自独立 Pages）见 [`archive/`](archive/README.md)。

## 拓扑

```
浏览器 ── 同一域名 ──> EdgeOne Makers
                        ├─ /            -> dist/index.html（官网 SPA）
                        ├─ /admin/*     -> dist/admin/index.html（后台 SPA，basename=/admin）
                        ├─ /static/*    -> dist/static/（演示图静态直出）
                        └─ /api/*       -> Python 云函数（平台剥离 /api 前缀）
                                            └─ /tmp/nuanhe/app.db（SQLite，非持久）
```

本地开发时四个进程各自独立：官网 3000（或 5173）、后台 3001（或 5174）、API 8000，
两个前端通过 Vite 代理把 `/api`、`/static` 转发到 8000，因此 `VITE_API_BASE` 留空即可。

## 目录结构

| 路径 | 职责 |
| --- | --- |
| `api/app/` | **后端唯一代码源**：config / db / models / schemas / security / routers |
| `api/init.sql` | 权威 DDL + 7 个索引；`api/app/models.py` 已声明同名索引 |
| `api/static/` | 演示图 `seed/` 与本地上传 `uploads/` |
| `frontend/src/` | 官网页面、组件、`lib/api.ts`、`lib/request.ts` |
| `backend/src/` | 后台页面、`lib/request.ts`、`store/auth.ts`、路由守卫 |
| `edgeone-app/build.py` | 部署产物生成器：同步云函数 + 构建两个前端 + 整体重建 `dist/` |
| `edgeone-app/cloud-functions/` | **生成物**，由 `build.py` 产出，禁止手工修改 |
| `edgeone-app/dist/` | **提交产物**（官网 + 后台 + 静态图），云端不安装子项目依赖；`--frontends` 时整体重建，不留历史 hash 包 |
| `tests/` | 可复现的 E2E 冒烟 |
| `docs/archive/` | 历史基线文档与已弃用方案 |

## 关键设计

- **单一代码源**：`api/app/` 是唯一真源。构建脚本清空 `cloud-functions/app/` 后整份复制，
  再用正则把**路由装饰器**中的 `/api` 前缀去掉（平台会剥离前缀），并把 `init.sql` 内嵌为
  `seed_bundle.py`（平台只打包 `.py`）。环境差异一律通过环境变量表达，不改代码。
- **鉴权**：JWT（HS256）+ RBAC。所有后台写接口挂 `Depends(require_perm(...))`；
  `get_current_user` 每次查库校验账号状态，并以 DB 的 `last_login_at` 判定首次改密，
  统一拦截除改密/`me` 外的全部接口。前端权限与菜单只是体验层，后端才是权威。
- **输入安全**：富文本用 bleach 白名单，留言等纯文本字段剥净标签并限长；
  上传按文件魔数判定类型、流式限大、uuid 重命名；静态响应带 `nosniff` 与 CSP。
- **数据**：SQLite 开启 `PRAGMA foreign_keys=ON`、WAL、`busy_timeout`；
  `IntegrityError` 统一映射 409；逻辑删除 + 审计字段（人员/时间分离）。
- **登录态**：JWT 存 localStorage；前端启动时调用 `/api/auth/me` 以服务端返回的权限与
  改密标记为准，避免过期令牌或被禁用账号先渲染后台。
- **前端加载**：官网与后台均按路由懒加载，Suspense 边界放在单个路由 element 内，
  切换页面不卸载外层 Layout；认证关键路径（登录 / 首次改密）与首页保持静态导入避免白屏。
  图片统一走 `ImgPlaceholder`（含 `onError` 品牌占位兜底），列表页区分「空数据」与「加载失败」并支持重试。
- **构建产物**：`build.py --frontends` 在两个 npm 构建成功后整体清空并重建 `dist/`，
  避免 `dirs_exist_ok` 合并导致旧 hash bundle 无限累积；重复构建产物清单一致。

## 已知技术债（按优先级）

1. 云函数数据落 `/tmp`，不持久、多实例不共享；要承载真实写入必须换外部数据库 + 对象存储。
2. JWT 仍在 localStorage（无 HttpOnly Cookie）、无 token 版本吊销机制，改密后旧令牌在 exp 内仍有效。
3. 官网列表页仍以 `page_size=100` 全量拉取后在客户端筛选，未做真实分页；数据量增长后需改服务端分页 + 分页器。
4. 后台主包仍约 826KB（Ant Design 为主）。已按路由拆分并把 RichTextEditor(334KB) /
   ImageUpload(82KB) 改为按需加载，但未做 `manualChunks` 级别的 vendor 拆分（避免循环依赖风险）。
5. 两个前端各自维护 `request.ts` 与实体类型，存在重复；理想方案是由 OpenAPI 生成共享类型包。
6. 迁移执行器未实现（`api/migrations/` 仅为目录约定），详见 [`database.md`](database.md) 第 7 章。
