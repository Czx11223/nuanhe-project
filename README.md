# 暖禾家具企业官网

家具企业官网 + 后台管理系统，单域名同源部署：官网 `/`、后台 `/admin`、API `/api`。
官网与后台均内置 DeepSeek AI 助手：官网提供家居咨询，后台提供操作指导与内容创作；回答通过 SSE 流式展示。

| 层 | 技术栈 | 权威配置 |
| --- | --- | --- |
| 官网 `frontend/` | React 18 + TypeScript + Vite + Tailwind | `frontend/package.json` |
| 后台 `backend/` | React 18 + TypeScript + Vite + Ant Design 5 | `backend/package.json` |
| 服务 `api/` | FastAPI + SQLAlchemy 2 + SQLite | `api/requirements.txt` |
| 部署 `edgeone-app/` | EdgeOne Makers（静态站 + Python 云函数） | `edgeone-app/edgeone.json` |

> 依赖版本、接口路径、DDL 一律以上表中的配置文件 / `api/openapi.json` / `api/init.sql` 为准，
> 不在文档里重复抄写，避免漂移。

## 快速开始

**一键启动（Windows）**：双击根目录 `start.bat`（GBK 编码，请勿用 UTF-8 另存）；停止用 `stop.bat`。

**手动启动**（三个终端）：

```bash
# 1) 后端 8000
cd api
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2) 官网 3000
cd frontend && npm ci && npm run dev

# 3) 后台 3001
cd backend && npm ci && npm run dev
```

首次启动自动建库并写入种子数据（见 `api/app/init_db.py`）。本地 `api/.env` 必须配置
`JWT_SECRET`，否则后端**拒绝启动**；模板见 `api/.env.example`。

### 端口对照

| 场景 | 官网 | 后台 | API |
| --- | --- | --- | --- |
| `vite.config.ts` 默认 | 3000 | 3001 | 8000 |
| `start.bat` 覆盖后 | 5173 | 5174 | 8000 |

`backend/package.json` 的 `dev` 脚本自带 `--port 5174`。CORS 白名单已同时覆盖这四组端口。

## 环境变量

| 变量 | 作用位置 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | `api/`, EdgeOne 云函数 | **必填**。高熵密钥；缺失或为示例值直接启动失败 |
| `ADMIN_INIT_PASSWORD` | `api/`, EdgeOne 云函数 | 初始管理员口令；不填则随机生成并打印到启动日志 |
| `DB_PATH` | `api/` | SQLite 路径，默认 `api/app.db` |
| `UPLOAD_DIR` | `api/` | 上传目录，默认 `api/static/uploads` |
| `CORS_ORIGINS` | `api/`, EdgeOne 云函数 | 逗号分隔的域名白名单；同源部署可留空 |
| `JWT_EXPIRE_MINUTES` | `api/`, EdgeOne 云函数 | 默认 120 |
| `AI_API_KEY` | `api/`, EdgeOne 云函数 | AI 功能必填；仅服务端保存，留空时 AI 返回 503，不影响其他业务 |
| `AI_BASE_URL` | `api/`, EdgeOne 云函数 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`（阿里云百炼兼容模式） |
| `AI_MODEL` | `api/`, EdgeOne 云函数 | 默认 `deepseek-v4-pro`；可换 `deepseek-v4-flash-0731` 等百炼模型 ID |
| `AI_TIMEOUT_SECONDS` | `api/`, EdgeOne 云函数 | 上游超时秒数，默认 60 |
| `AI_MAX_TOKENS` | `api/`, EdgeOne 云函数 | 单次回答上限，默认 1200 |
| `AI_TEMPERATURE` | `api/`, EdgeOne 云函数 | 采样温度，默认 0.7；推理模型自动忽略 |
| `AI_ENABLE_THINKING` | `api/`, EdgeOne 云函数 | 思考模式；留空按模型自动（V4 默认关闭），可设 true/false |
| `VITE_API_BASE` | 两个前端 | 本地与同源部署留空 |
| `VITE_BASE_PATH` | `backend/` | 后台子路径，EdgeOne 构建注入 `/admin` |
| `VITE_STATIC_BASE` | 两个前端 | 构建期注入，保留给分离部署场景 |

生成密钥：`python -c "import secrets; print(secrets.token_urlsafe(48))"`

使用 AI 前，在 `api/.env` 配置 `AI_API_KEY`（阿里云百炼控制台「API-KEY 管理」创建的个人 Key），
`AI_BASE_URL` 保持默认的百炼兼容模式地址，`AI_MODEL` 按模型广场填写（默认 `deepseek-v4-pro`）；
部署时在 EdgeOne 控制台单独配置同名变量。旧的 `DEEPSEEK_*` 变量仍兼容，但建议统一用 `AI_*`。
**不得将模型密钥设置为 `VITE_` 变量或写入前端代码。**聊天仅保留在当前页面状态中，刷新后清空。

配置后可先自检上游连通性：

```bash
python api/scripts/ai_check.py                      # 使用当前 AI_MODEL
python api/scripts/ai_check.py --model deepseek-v4-flash-0731  # 临时换模型验证
python api/scripts/ai_check.py --list                # 列出该 Key 可访问的模型
```

## 初始管理员与改密

- 账号固定 `admin`；口令来自 `ADMIN_INIT_PASSWORD`，未配置时由 `api/app/seed.py` 随机生成并**只在启动时打印一次**。
- 首次登录返回 `must_change_password=true`，除 `/api/auth/change-password`、`/api/auth/me` 外所有接口返回 403。
- 源码与文档均不保存任何可用口令。已有数据库不会重置口令；忘记时按 `docs/deployment.md` 的「重置演示库」处理。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | 现行架构、目录结构、关键设计与技术债 |
| [`docs/deployment.md`](docs/deployment.md) | **唯一现行部署手册**（EdgeOne 同源）、验收与已知限制 |
| [`docs/api-contract.md`](docs/api-contract.md) | 统一响应、错误码、分页、RBAC 权限键 |
| [`docs/database.md`](docs/database.md) | 数据库设计 v1.1 修订版（ER 图见 `暖禾-er-diagram.svg`） |
| [`docs/testing.md`](docs/testing.md) | 自动化测试运行方式与结论口径 |
| [`docs/archive/`](docs/archive/README.md) | 历史基线文档、已弃用的 FC 方案（不再维护） |

接口清单由 `api/openapi.json` 自动生成，不要手写。

## 部署

现行方案为 **EdgeOne Makers 同源部署**，完整步骤见 [`docs/deployment.md`](docs/deployment.md)：

```bash
python edgeone-app/build.py --frontends   # 生成 dist/ 与 cloud-functions/
```

三条必须记住的约束：

1. 部署前在 EdgeOne 控制台配置 `JWT_SECRET`（否则云函数启动失败）与 `ADMIN_INIT_PASSWORD`（否则每次冷启动口令都变）。
2. `edgeone-app/dist/` 是**提交产物**，每次 `--frontends` 都会整体重建（不残留旧 hash 包）；改了前端就要重新构建并提交，云端 `npm run build` 只同步云函数并校验产物。
3. 云函数数据落在 `/tmp/nuanhe`，**不持久化**：冷启动/重新部署会恢复初始数据，多实例之间不共享。这是演示方案，不可直接承载生产写入。

## 常见问题

- **后端启动报 `JWT_SECRET 未配置`**：复制 `api/.env.example` 为 `api/.env` 并填入随机密钥。
- **后台 401 后跳到官网**：确认 `VITE_BASE_PATH=/admin` 已由构建脚本注入（本地开发为 `/` 属正常）。
- **图片 404**：演示图在 `dist/static/seed/`，新上传图返回 `/api/static/uploads/...` 走云函数；两者不要混用。
- **`start.bat` 找不到解释器**：脚本优先用 WorkBuddy 内置 Python，可改用 PATH 中的 `python`。

## 测试

```bash
pip install -r requirements-dev.txt
python tests/smoke.py
```

详见 [`docs/testing.md`](docs/testing.md)。
