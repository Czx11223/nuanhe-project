# API 契约

> 接口清单以 [`api/openapi.json`](../api/openapi.json) 为唯一来源，由 FastAPI 自动生成。
> 本文只说明跨接口的统一约定，**不手写接口表**。浏览器访问后端 `/docs` 可看实时 Swagger。

## 统一响应

成功：`{"code": 0, "data": <业务数据>, "msg": "ok"}`

失败：`{"code": <HTTP 状态码>, "msg": "<错误描述>"}`

分页：`data = {"list": [...], "total": N, "page": p, "page_size": s}`

`api/app/responses.py` 的中间件会把裸 JSON 自动包成上述结构；异常处理器负责错误分支。
前端两个 `lib/request.ts` 在响应拦截器里解包 `data`，调用方直接拿业务数据。

## 错误码

| HTTP / code | 含义 | 常见来源 |
| --- | --- | --- |
| 400 | 参数或业务校验失败 | 原密码错误、上传类型不符、重复数据前置校验 |
| 401 | 未登录 / 令牌无效 / 账号被禁用 | `get_current_user` |
| 403 | 无权限 / 首次登录未改密 | `require_perm`、首次改密统一拦截 |
| 404 | 资源不存在 | 各 `db.get` |
| 409 | 唯一键或外键冲突 | `IntegrityError` 全局处理器 |
| 422 | Pydantic 参数校验失败 | 请求体/查询参数类型错误 |
| 429 | 触发限流 | 匿名留言、官网/后台 AI 对话 |
| 503 | 外部服务未配置 | 未配置 `AI_API_KEY` 的 AI 接口 |
| 500 | 未捕获异常 | 兜底处理器（不泄露堆栈） |

## 分页与筛选

- 后台列表：`GET /api/{module}/admin`，参数 `page`、`page_size`（`1..100`）、`keyword`、
  以及模块专属筛选项；过滤与 `count()` 全部下推到 SQL，条件一致。
- 前台公开列表：参数更精简，只返回启用/已发布记录；`page` 会被兜底为至少 1。
- 模糊匹配使用 `.contains()`；排序字段均为硬编码 ORM 列，不接受客户端传入的列名。

## 鉴权与权限键

- 登录：`POST /api/auth/login` → `{access_token, user, must_change_password}`。
- 之后请求带 `Authorization: Bearer <token>`。
- `GET /api/auth/me` 返回用户信息、权限数组与**服务端权威**的 `must_change_password`。
- `POST /api/auth/change-password` 成功后返回新令牌。
- 首次登录未改密时，除上述两个接口外的所有接口一律 403。

权限键（`role.permissions` 数组，`*` 表示全部）：

`banner` / `about` / `product_category` / `product` / `news` / `case` / `recruitment` /
`message` / `site_setting` / `admin` / `role`

内置角色：`super_admin`（`["*"]`）、`editor`（内容相关）、`operator`（`message` + `site_setting`）。
权限每次请求从库读取，角色变更即时生效；前端菜单与 `ProtectedRoute` 只是体验层。

## 富文本与上传

- 富文本字段入库前经 bleach 白名单清洗；留言等纯文本字段剥净所有标签并限长。
- 上传：`POST /api/upload`，仅接受真实 jpeg / png / webp（按魔数判定），≤ 5MB，
  返回本地 `/static/uploads/<uuid>.<ext>`；部署版返回 `/api/static/uploads/...` 以命中云函数。
- 静态响应统一带 `X-Content-Type-Options: nosniff` 与 CSP。

## AI 流式响应

`POST /api/ai/chat`（官网）与 `POST /api/admin/ai/chat`（管理员 JWT）使用
`Content-Type: text/event-stream`，不套 `{code,data,msg}` 成功响应。每个 SSE `data` 为 JSON：

- 文本增量：`{"type":"delta","content":"..."}`
- 正常结束：`{"type":"done"}`
- 流内异常：`{"type":"error","message":"可安全展示的信息"}`

请求体仅允许 `messages`，每条消息角色只能是 `user` 或 `assistant`；最多 16 条、总长度
12000 字符，最后一条必须为 `user`。系统提示词、模型、密钥和输出参数均由服务端控制。
请求开始前的鉴权/参数/配置错误仍返回统一 JSON 错误结构。

## 重新生成 OpenAPI

```bash
cd api
python -c "import json; from app.main import app; print(json.dumps(app.openapi(), ensure_ascii=False, indent=2))" > openapi.json
```

需要 `api/.env` 中已配置 `JWT_SECRET`（否则 `config.py` 会拒绝启动）。
接口变更后必须重新生成并提交 `api/openapi.json`。
