# 暖禾家具官网 —— 阿里云 FC + 腾讯 EdgeOne Pages 部署指南

> 适用版本：本仓库当前代码（FastAPI + SQLite / React 官网 / React 后台）
> 目标形态：官网与后台托管在 EdgeOne Pages（静态 + 全球加速），API 跑在阿里云函数计算 FC（自定义容器），数据持久化在 NAS。

---

## 一、先看架构

```
浏览器
  │
  ├─ https://nuanhe.edgeone.app        →  EdgeOne Pages（frontend/dist 静态站）
  ├─ https://nuanhe-admin.edgeone.app  →  EdgeOne Pages（backend/dist 后台）
  │
  └─ https://xxx.cn-hangzhou.fcapp.run →  阿里云 FC 容器（FastAPI，端口 9000）
                                              │
                                              ├─ /api/*    业务接口（JWT 鉴权）
                                              └─ /static/* 图片（NAS 上的 /mnt/nas/nuanhe）
                                                    │
                                              NAS（app.db + uploads + seed）
```

关键点：**前端与后端不同域**，所以走「构建时注入 `VITE_API_BASE` + 后端放开 CORS」，上传与图片都直连 FC，不经过 Pages 转发。

为什么不反代：EdgeOne Pages 的 `rewrites` 只对静态资源生效；边缘函数（V8）请求体上限 1MB，而你后台单图上传上限是 5MB，走反代必然失败。

---

## 二、前置条件

| 项目 | 要求 |
|---|---|
| 阿里云 | 已实名；开通 **函数计算 FC 3.0**、**容器镜像服务 ACR**、**文件存储 NAS**、**专有网络 VPC** |
| 腾讯云 | 已实名；开通 **EdgeOne Pages** |
| 地域 | FC 与 NAS **必须同地域**（建议 `华东1（杭州）`），VPC 也在该地域 |
| 本地 | Docker（构建镜像用）；或使用阿里云 Cloud Shell 构建 |
| 域名 | 没有备案域名也能上线：API 用 `*.fcapp.run`，网站用 Pages 默认域名。若要绑自己的域名且走大陆节点，**必须先 ICP 备案** |

---

## 三、部署 API（阿里云 FC）

> **两条路径，任选一条**：
> - **A. 手工（控制台）**：按 3.1 → 3.5 一步步点。
> - **B. 脚本（推荐）**：3.2、3.3 这两步（VPC / 交换机 / 安全组 / NAS / FC 函数 / 触发器）由 `deploy/provision.ps1` 一次创建完成，见 **3.6**。手工步骤建议留着当对照。

### 3.1 构建镜像并推送到 ACR

**方式一：ACR 在线构建（无需本机 Docker，推荐）**

1. 项目代码推到 GitHub / Gitee / 云效 Codeup（当前仓库已托管在 GitHub）。
2. ACR 控制台 → 镜像仓库 → 创建命名空间（如 `nuanhe`）+ 创建仓库（`nuanhe-api`，私有即可）。
3. 进入仓库 → 「构建」→ 新建规则：
   - 代码源：绑定你的 GitHub 仓库，分支 `main`
   - Dockerfile 路径：`deploy/fc/Dockerfile`
   - **构建上下文目录：`.`（仓库根目录，不能填 `deploy/fc`，否则 `COPY api/` 会失败）**
   - 镜像版本：固定填 `v1`（不要留空，否则 FC 报 `image uri should have tag`）
4. 触发构建，等状态变为「成功」，到「镜像版本」页确认已有 `v1`。

**方式二：本地 Docker**

```bash
# 1) 登录 ACR（把 registry 换成你的实例地址）
docker login --username=<你的阿里云账号> registry.cn-hangzhou.aliyuncs.com

# 2) 构建（Apple 芯片必须带 --platform linux/amd64，FC 只支持 amd64）
docker build --platform linux/amd64 -f deploy/fc/Dockerfile \
  -t registry.cn-hangzhou.aliyuncs.com/<命名空间>/nuanhe-api:v1 .

# 3) 推送
docker push registry.cn-hangzhou.aliyuncs.com/<命名空间>/nuanhe-api:v1
```

镜像里做了什么（`deploy/fc/entrypoint.sh`）：

1. 首次启动把内置种子库 `app.db` 和演示图片复制到 NAS（已存在则不覆盖，保护线上数据）；
2. 把 `DB_PATH`、`UPLOAD_DIR` 指向 NAS；
3. 以 `0.0.0.0:9000` 启动 uvicorn，`--timeout-keep-alive 900`、`--workers 1`（SQLite 单写者）。

### 3.2 创建 NAS

1. 控制台 → 文件存储 NAS → 创建文件系统（**容量型**，与 FC 同地域）。
2. 创建挂载点，选择与 FC 同一个 **VPC + 交换机**，权限组用默认（允许 `0.0.0.0/0` 读写）。
3. 记下：**文件系统 ID**、**挂载点域名**。

> 代码会自动创建 `/mnt/nas/nuanhe` 子目录并初始化数据，你不需要手动准备文件。
> 费用：容量型约 0.35 元/GB/月，最小购买容量以控制台为准；若只想零成本试跑，可先不挂 NAS（数据会随实例回收丢失，仅适合看效果）。

### 3.3 创建 FC 函数（自定义容器）

控制台 → 函数计算 FC → 创建函数 → **使用容器镜像**：

| 配置项 | 值 |
|---|---|
| 函数名称 | `nuanhe-api` |
| 地域 | 与 NAS 相同 |
| 镜像 | 3.1 推送的 `nuanhe-api:v1`（**必须选中具体「镜像版本」，只选仓库会报 image uri should have tag**） |
| 监听端口 | `9000` |
| 启动命令 | 留空（镜像 ENTRYPOINT 已含） |
| 规格 | 0.5 vCPU / 1 GB 起（够演示用） |
| 执行超时 | `60` 秒 |
| 实例数上限 | **1**（SQLite 只能单写者，务必设 1） |
| 预留实例 | 可选 `1`（避免冷启动 3~6 秒；按小时计费） |

**环境变量**（函数配置 → 环境变量）：

| 变量 | 值 | 说明 |
|---|---|---|
| `DATA_DIR` | `/mnt/nas/nuanhe` | NAS 数据根目录 |
| `DB_PATH` | `/mnt/nas/nuanhe/app.db` | SQLite 路径 |
| `UPLOAD_DIR` | `/mnt/nas/nuanhe/uploads` | 上传目录（`/static` 挂载其父目录） |
| `JWT_SECRET` | 32 位以上随机串 | **必须改**，否则用默认密钥可伪造 token |
| `JWT_EXPIRE_MINUTES` | `720` | 后台登录有效期 |
| `CORS_ORIGINS` | `*`（首次） | 拿到 Pages 域名后改成精确域名，见 3.5 |

生成随机密钥：`openssl rand -hex 32`

**NAS 挂载**（函数配置 → 存储 → NAS）：

| 配置项 | 值 |
|---|---|
| 文件系统 | 3.2 创建的文件系统 |
| 挂载点 | 同 VPC 的挂载点 |
| 本地挂载目录 | `/mnt/nas` |
| 用户 ID / 组 ID | `0` / `0`（root，避免 SQLite 写入权限问题） |

**HTTP 触发器**（函数配置 → 触发器 → 创建）：

| 配置项 | 值 |
|---|---|
| 触发器类型 | HTTP 触发器 |
| 请求方法 | ALL |
| 认证方式 | **无需认证**（鉴权由应用内 JWT 负责） |
| 公网地址 | 创建后得到 `https://nuanhe-api-xxxx.cn-hangzhou.fcapp.run` |

> 这个 `fcapp.run` 地址就是后文的 `API_BASE`，先记下来。
> 大陆地域直接用 `fcapp.run` 访问返回 HTML 会被转成下载，但**纯 JSON 接口不受影响**；网站本身在 Pages 上，不经过这个域名。

**健康检查**（可选但建议）：路径 `/api/health`，期望 200。

### 3.4 验证 API

```bash
API=https://nuanhe-api-xxxx.cn-hangzhou.fcapp.run

curl "$API/api/health"
# {"code":0,"msg":"ok","data":{"service":"暖禾-api","status":"up"}}

curl -o /dev/null -w "%{http_code}\n" "$API/static/uploads/nuanhe-logo.png"
# 200（说明 NAS 已挂载且种子图片已就位）

curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<见初始化日志>"}' | head -c 200
# {"code":0,"data":{"access_token":"...","user":{...}},"msg":"ok"}
```

若图片 404：看函数日志里有没有 `[init] seed database -> ...`，确认 NAS 挂载目录是 `/mnt/nas`、`UPLOAD_DIR=/mnt/nas/nuanhe/uploads`。

### 3.5 回填 CORS

第一次先设 `CORS_ORIGINS=*` 让站点能跑通；拿到 Pages 域名后改成精确值并保存（会自动发新版本）：

```
CORS_ORIGINS=https://nuanhe.edgeone.app,https://nuanhe-admin.edgeone.app
```

> 配 `*` 时代码会自动关闭 `allow_credentials`（本项目用 Bearer token，不依赖 Cookie），所以 `*` 也能正常工作，但精确域名更安全。

### 3.6 一键创建脚本（替代 3.2 + 3.3）

`deploy/provision.ps1` 把 **VPC → 交换机 → 安全组 → NAS 文件系统 → 挂载点 → FC 函数 → HTTP 触发器** 一次建完，幂等：已存在的资源按名字复用，不会重复创建。

**前置**：`aliyun` CLI + 一次 `aliyun configure`（填 AccessKeyId / Secret / 默认地域 `cn-hangzhou`）。

```powershell
# 1) 先看计划，不做任何变更
.\deploy\provision.bat -Image registry.cn-hangzhou.aliyuncs.com/nuanhe/nuanhe-api:v1 -Plan

# 2) 正式创建
.\deploy\provision.bat -Image registry.cn-hangzhou.aliyuncs.com/nuanhe/nuanhe-api:v1

# 3) 以后改了代码、重新构建了 v2，更新函数即可
.\deploy\provision.bat -Image registry.cn-hangzhou.aliyuncs.com/nuanhe/nuanhe-api:v2 -Update
```

> 用 `provision.bat` 而不是直接右键运行 `.ps1`：Windows 默认禁止执行脚本，bat 内部用 `-ExecutionPolicy Bypass` 只对这一条命令放行，不改系统设置。

**主要参数**

| 参数 | 默认 | 说明 |
|---|---|---|
| `-Image` | 必填 | ACR 完整地址，必须带 tag |
| `-Region` | `cn-hangzhou` | 必须与 ACR、NAS 同地域 |
| `-Prefix` | `nuanhe` | 资源名前缀，生成 `nuanhe-vpc` / `nuanhe-nas` 等 |
| `-FunctionName` | `nuanhe-api` | FC 函数名 |
| `-Cpu` / `-MemorySize` | `1` / `1024` | 比例须在 1:1 ~ 1:4，内存是 64 的倍数 |
| `-JwtSecret` | 自动生成 | 建议自己指定并留存 |
| `-CorsOrigins` | `*` | 拿到 Pages 域名后改 |
| `-AcrUserName/-AcrPassword` | 空 | 仓库为私有时填 ACR 固定密码 |
| `-Update` | — | 函数已存在时用它更新镜像 |

**脚本产出的信息**：VPC / 交换机 / 安全组 / 文件系统 ID、NAS 挂载域名、以及 **`https://xxx.cn-hangzhou.fcapp.run`** 的 API 地址，同时写入 `deploy/.provision-state.json`（下次运行自动续用，不要提交到 Git）。

**需要的 RAM 权限**（建议建一个子账号只授这几项）：

```
AliyunVPCFullAccess
AliyunECSFullAccess      # 仅用于创建安全组
AliyunNASFullAccess
AliyunFCFullAccess
AliyunSTSGetCallerIdentity
```

**脚本不做的四件事**（仍需手工）：

1. **ACR 命名空间 / 仓库 / 在线构建**（3.1）——个人版建仓与绑定代码源要走控制台授权。
2. **函数实例数上限设为 1**：控制台 → 函数 → 弹性配置 → 函数配额。该 API 未在 `fc` 公开接口中提供，必须控制台点一次（保护 SQLite 单写者）。
3. **EdgeOne Pages**（第四章）。
4. **NAS 备份 / 生命周期策略**，演示项目可忽略。

---

## 四、部署两个前端（EdgeOne Pages）

仓库里已经放好 `frontend/edgeone.json` 与 `backend/edgeone.json`（构建命令、输出目录、SPA fallback、缓存头）。

### 4.1 官网前台

腾讯云控制台 → EdgeOne → Pages → 新建项目 → 关联 Git 仓库：

| 配置项 | 值 |
|---|---|
| 项目名称 | `nuanhe-site` |
| 根目录 | `frontend` |
| 框架预设 | Vite |
| 构建命令 | `npm ci && npm run build`（edgeone.json 已声明） |
| 输出目录 | `dist` |
| Node 版本 | `22.11.0` |
| 环境变量 | `VITE_API_BASE = https://nuanhe-api-xxxx.cn-hangzhou.fcapp.run` |

### 4.2 后台管理

同样步骤再建一个项目：

| 配置项 | 值 |
|---|---|
| 项目名称 | `nuanhe-admin` |
| 根目录 | `backend` |
| 构建命令 | `npm ci && npm run build` |
| 输出目录 | `dist` |
| 环境变量 | `VITE_API_BASE` 同上 |

> `VITE_API_BASE` **必须带 `https://`、结尾不要带 `/`**，且要在第一次构建前就配好，改完需重新部署才生效。

### 4.3 访问控制（重要）

后台是公网可访问的登录页，答辩演示没问题，但别长期公开。建议二选一：

1. 只部署官网，后台继续本地跑；
2. 用 EdgeOne 的访问控制/防护策略，对 `nuanhe-admin` 域名加 IP 白名单或基础认证。

---

## 五、验收清单

按顺序过一遍，这些点覆盖了最容易出问题的地方：

- [ ] `GET /api/health` 返回 `code:0`
- [ ] `/static/uploads/nuanhe-logo.png` 返回 200 且大小约 138KB
- [ ] 官网首页轮播、产品卡片图片正常显示（不是灰块）
- [ ] 官网产品详情页多图切换正常
- [ ] 后台能登录（`admin` / 初始密码），工作台数据能加载
- [ ] 后台「站点设置」上传一张新 Logo → 官网刷新后能看到
- [ ] **在 FC 控制台重启实例（或等实例回收后冷启动），再刷新官网，上传的 Logo 仍在** ← 这一条验证 NAS 持久化成功
- [ ] 浏览器 Network 里 `/api/*` 请求域名是 `fcapp.run`，且无 CORS 报错
- [ ] 手机端打开官网排版正常

---

## 六、日常更新

**只改前端**：推 Git → Pages 自动重新构建（约 1~2 分钟）。

**改后端代码**：

```bash
docker build --platform linux/amd64 -f deploy/fc/Dockerfile \
  -t registry.cn-hangzhou.aliyuncs.com/<命名空间>/nuanhe-api:v2 .
docker push registry.cn-hangzhou.aliyuncs.com/<命名空间>/nuanhe-api:v2
```

然后在 FC 控制台把函数镜像改成 `v2` 并保存（或直接用新 tag 覆盖更新函数）。数据库与上传文件在 NAS 上，**更新镜像不会丢数据**。

**备份数据**：NAS 控制台可下载 `/nuanhe/app.db`；建议每次重要演示前备份一次。

---

## 七、常见问题

| 现象 | 原因与处理 |
|---|---|
| `FunctionNotStarted` / 502 | 容器没监听 `0.0.0.0:9000`，或监听端口与函数配置的 9000 不一致 |
| 接口 404，路径看着没错 | FC 没配 HTTP 触发器，或访问了 `/health`（真实路径是 `/api/health`） |
| 图片全部 404 | NAS 未挂载到 `/mnt/nas`；或 `UPLOAD_DIR` 没指向 NAS，导致 `/static` 挂到空的容器目录 |
| 后台能登录但列表一直转圈 | `CORS_ORIGINS` 没包含当前 Pages 域名（看浏览器 Console 的 CORS 报错） |
| 上传成功但重启后图片没了 | 没挂 NAS，或 `UPLOAD_DIR` 指向容器内路径 |
| `database is locked` | FC 实例数 > 1，SQLite 并发写冲突；把实例数上限改为 1 |
| 冷启动 3~6 秒 | Serverless 正常现象；配 1 个预留实例可消除 |
| 打开 `fcapp.run` 是下载文件 | 大陆地域对 HTML 响应强制下载，属平台限制；网站请走 Pages，接口是 JSON 不受影响 |
| Pages 构建失败 | 看构建日志：多为 `npm ci` 缺 lock 文件或 Node 版本不符；本项目要求 Node 22.11.0 |
| 修改了 `VITE_API_BASE` 不生效 | 环境变量只在构建时注入，必须重新部署一次 |
| 创建函数报 `image uri should have tag` | 镜像地址缺版本号。① ACR 该仓库里根本没有 tag（`docker push` 没成功或在线构建失败）→ 去 ACR「镜像版本」页确认有 `v1`；② 有 tag 但选镜像时只点了仓库名、没在右侧列表选中具体版本 → 重新打开弹窗，先选仓库再选版本，最后点「确定」 |

---

## 八、成本参考（演示级）

| 资源 | 规格 | 量级 |
|---|---|---|
| FC | 0.5 vCPU / 1GB，按量 | 每月几元（含 40 万 GB-秒免费额度） |
| NAS | 容量型，最小规格 | 按容量计费，约 0.35 元/GB/月（具体以控制台为准） |
| ACR | 个人版 | 免费 |
| EdgeOne Pages | 免费额度 | 演示流量足够 |

---

## 九、本仓库为部署做的改动

| 文件 | 作用 |
|---|---|
| `deploy/fc/Dockerfile` | FC 自定义容器镜像（Python 3.12 + uvicorn 9000） |
| `deploy/fc/entrypoint.sh` | 首次启动初始化 NAS（种子库 + 演示图）、导出 DB/UPLOAD 路径、启动服务 |
| `deploy/scripts/build.sh` | 本地构建两个前端并注入 `VITE_API_BASE`，附产物校验 |
| `frontend/edgeone.json` | 前台 Pages 构建配置 + SPA fallback + 缓存/安全头 |
| `backend/edgeone.json` | 后台 Pages 构建配置（同上） |
| `frontend/src/lib/asset.ts` | 新增：把后端返回的 `/static/...` 补全为 FC 绝对地址 |
| `frontend/src/components/ImgPlaceholder.tsx`、`Header.tsx`、`Footer.tsx`、`pages/ProductDetail.tsx` | 图片渲染统一走 `assetUrl()`，支持前后端不同域 |
| `api/app/main.py` | CORS 支持 `*`（此时自动关闭 credentials），便于首次上线 |
| `.dockerignore` | 缩小镜像构建上下文，排除 node_modules / 前端产物 / 本地 env |
