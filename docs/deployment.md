# 部署手册（EdgeOne Makers 同源）

> 这是**唯一现行**部署方案。原阿里云 FC + NAS + Docker 方案已归档到
> [`archive/fc-legacy/`](archive/fc-legacy/README-部署指南.md)，**请勿按归档文档操作**。

## 1. 架构与前缀规则

一个域名同时提供官网 `/`、后台 `/admin`、API `/api`。平台把 `/api` 前缀剥离后再把请求交给
Python 云函数，因此云函数内部注册的是 `/health`、`/products`、`/upload` 等**不带 `/api`** 的路由，
而前端请求与文档描述仍使用 `/api/...`。这是最容易踩坑的地方，改路由时不要手工改两份代码。

`edgeone-app/edgeone.json` 的 rewrite 顺序必须是 `/admin/* -> /admin/index.html` 在前、
`/* -> /index.html` 兜底在后。

## 2. 平台侧前置配置（必做）

在 EdgeOne 控制台给项目 `nuanhe-site` 配置环境变量：

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | **必填** | 缺失时云函数 `config.py` 直接抛错，实例启动失败 |
| `ADMIN_INIT_PASSWORD` | 演示站建议必填 | 不填则每次冷启动随机生成，口令只出现在函数日志，实际无法登录 |
| `CORS_ORIGINS` | 可选 | 同源部署留空；确需跨域时填逗号分隔的域名白名单 |
| `JWT_EXPIRE_MINUTES` | 可选 | 默认 120 |
| `AI_API_KEY` | AI 功能必填 | 阿里云百炼（千问 AI 平台）个人 API Key；留空时 AI 返回 503，不影响其他接口 |
| `AI_BASE_URL` | 可选 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `AI_MODEL` | 可选 | 默认 `deepseek-v4-pro`；以百炼模型广场的模型 ID 为准 |
| `AI_TIMEOUT_SECONDS` | 可选 | 默认 60；平台函数超时应不小于该值 |
| `AI_MAX_TOKENS` | 可选 | 默认 1200 |
| `AI_TEMPERATURE` | 可选 | 默认 0.7；`deepseek-r1` 等推理模型自动忽略 |
| `AI_ENABLE_THINKING` | 可选 | 思考模式；留空按模型自动（V4 默认关闭），可设 `true`/`false` |

生成密钥：`python -c "import secrets; print(secrets.token_urlsafe(48))"`

> **重要**：本仓库的 `api/.env`（含本地密钥）被 `.gitignore` 排除，不会随代码上传；
> 平台环境变量必须单独配置。轮换 `JWT_SECRET` 会使所有已签发令牌立即失效。
> DeepSeek 模型经阿里云百炼（千问 AI 平台）的 OpenAI 兼容端点调用，密钥同样只在平台环境变量中配置，
> 并需确认云函数具备访问 `dashscope.aliyuncs.com` 的出站网络与 SSE 流式响应能力。
> 常见失败：模型 ID 拼错（400/404，返回「AI 模型配置有误」）、用了应用 Key 而非个人 Key（403）、额度或限流（429）。

## 3. 本地构建

```bash
# 在任意目录执行均可（脚本以自身位置定位项目根）
python edgeone-app/build.py --frontends
```

该命令会：清空并重新同步 `cloud-functions/app/` → 内嵌 `init.sql` → 生成 `api/index.py` →
分别构建两个前端（后台注入 `VITE_BASE_PATH=/admin` 与 `--base=/admin/`）→ **整体清空并重建**
`edgeone-app/dist/` → 复制 51 张演示图到 `dist/static/`。

`dist/` 是纯生成物，每次 `--frontends` 都从零重建，不会残留旧 hash 的 bundle（早期用合并方式
曾累积多份 1.6MB 包）。清空动作放在两个 npm 构建**成功之后**，构建失败时上一版可用产物保持不动。

**只改后端**时可用 `python edgeone-app/build.py`（跳过前端构建，也不会清空 `dist/`）。

构建产物检查：

```bash
cd edgeone-app && node build.mjs
```

该脚本会再次同步云函数并校验 `dist/index.html`、`dist/admin/index.html`、`dist/static/`、
`cloud-functions/api/index.py`、`seed_bundle.py`、`requirements.txt` 是否齐备。

## 4. 提交与部署

`edgeone-app/dist/` 与 `cloud-functions/` 都纳入版本控制，云端构建环境不会安装
`frontend/`、`backend/` 的依赖。改完代码务必重新构建并提交：

```bash
python edgeone-app/build.py --frontends
git add edgeone-app && git commit -m "build: 更新部署产物"
```

云端 `buildCommand` 为 `npm run build`（`node build.mjs`），它只做云函数同步与产物校验，
不重复构建前端。部署命令示例（国内环境建议带镜像源）：

```bash
UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ \
  edgeone makers deploy --json -n nuanhe-site
```

部署前若本机留有 `.edgeone/` 旧缓存，先移走（Windows 版依赖与生产 Linux 运行时冲突）。

## 5. 验收清单

| 检查 | 期望 |
| --- | --- |
| `GET /` | 200，引用 `/assets/...` |
| `GET /admin` | 200，引用 `/admin/assets/...` |
| `GET /api/health` | 200 且 `code=0`（云函数内部为 `/health`） |
| `GET /api/products` | 200，返回分页数据 |
| `GET /static/seed/banner-1.svg` | 200，`content-type: image/svg+xml` |
| `POST /api/auth/login` | 用 `ADMIN_INIT_PASSWORD` 可登录，返回 `must_change_password=true` |
| 上传一张图片 | 返回 `/api/static/uploads/<uuid>.png`，GET 该 URL 返回 `image/png` 而非 HTML |
| `GET /api/static/uploads/` 下的伪装 HTML | 被 400 拒绝上传，静态响应带 `nosniff` |
| 官网 AI 提问 | SSE 逐段返回；未配置密钥时明确提示 503 |
| 后台 AI 提问 | 有效管理员 JWT 可流式提问；未登录 401、首次未改密 403 |

## 6. 已知限制（演示方案，必须告知使用方）

1. **数据不持久**：SQLite 与上传文件都在 `/tmp/nuanhe`，冷启动、重新部署、弹性扩容都会
   从 `init.sql` + `seed()` 重建初始库，后台编辑、留言、上传、改密全部回滚。
2. **多实例不一致**：每个实例持有独立的 `/tmp` 副本，同一用户连续请求可能读到不同版本数据。
3. **临时域名**：`*.edgeone.cool` 预览域名带鉴权且有效期约 3 小时；长期公开需在控制台绑定
   自定义域名，中国大陆加速区域需完成 ICP 备案。
4. **不适合生产写入**：如需真实持久化，须替换存储层为托管数据库 + 对象存储，并重新评估
   并发与鉴权方案（HttpOnly Cookie / token 吊销）。
5. 密钥、初始口令均不入库；仓库里的 `api/app.db*` 已从版本控制移除，本地文件仅作开发用。
6. **AI 配额为实例级**：官网同 IP 每分钟 5 次、后台同管理员每分钟 20 次；多实例不共享计数，
   正式上线仍应在 DeepSeek 控制台设置费用上限。对话不持久化，刷新页面后清空。

## 7. 回滚与重置

- **回滚代码**：`git revert` 后重新执行第 3、4 步；平台侧环境变量保持不变。
- **重置演示库**：删除实例 `/tmp/nuanhe/app.db`（或重新部署），下次冷启动自动重建；
  口令取 `ADMIN_INIT_PASSWORD`，未配置时看函数日志。
- **忘记本地管理员口令**：删除 `api/app.db`（已排除出版本控制）后重启后端，按
  `ADMIN_INIT_PASSWORD` 或启动日志中的随机口令登录。
