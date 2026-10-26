# 暖禾 后台管理系统（backend/）

基于 **React 18 + TypeScript + Ant Design 5 + Vite** 的企业家居网站后台管理界面。
对应 PRD「后台管理系统」与 UIUX 文档第 4 章（App Shell + 11 模块 + 极简蓝调 Apple 变体）。

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | React 18 + TypeScript |
| UI 组件库 | Ant Design 5（主题令牌见 `src/theme.ts`） |
| 路由 | react-router-dom 6 |
| 状态/登录态 | zustand |
| HTTP 客户端 | axios（统一 `{code,data,msg}` 解包，见 `src/lib/request.ts`） |
| 富文本 | TipTap（StarterKit + Image + Link，见 `src/components/RichTextEditor.tsx`） |
| 构建 | Vite 5 |

## 目录结构

```
backend/
├─ src/
│  ├─ main.tsx              # 入口：ConfigProvider + AntApp + BrowserRouter
│  ├─ App.tsx               # 路由表（公开/受保护/兜底）
│  ├─ index.css             # 全局样式重置
│  ├─ theme.ts              # AntD 主题令牌（#007AFF、禁阴影、圆角 8）
│  ├─ lib/
│  │  ├─ request.ts         # axios 实例 + 统一响应/错误处理
│  │  ├─ types.ts           # 后端实体类型（对齐 schemas.py）
│  │  └─ perm.ts            # 权限键常量 + 判定
│  ├─ store/
│  │  └─ auth.ts            # 登录态（Zustand + localStorage 持久化）
│  ├─ components/
│  │  ├─ AppLayout.tsx      # App Shell（顶栏56 + 侧栏240 + 动态 RBAC 菜单）
│  │  ├─ menuConfig.tsx     # 菜单分组（与路由 path 一致）
│  │  ├─ ProtectedRoute.tsx # 路由/权限守卫（未登录→/login；需改密→/change-password；无权限→403）
│  │  ├─ PageHeader.tsx     # 页头组件
│  │  ├─ RichTextEditor.tsx # TipTap 富文本（含 XSS 清洗由后端负责）
│  │  └─ ImageUpload.tsx    # 图片上传（调取 /api/upload）
│  └─ pages/                # 12 个页面（工作台 + 11 模块，含登录/改密）
├─ vite.config.ts           # 端口 5174 + /api、/static 代理到 8000
├─ tsconfig.json
├─ package.json
└─ README.md
```

## 本地运行

> 前置：先启动后端 API（`../api`，FastAPI，默认 8000），后台通过 Vite 代理访问它。

```bash
# 1. 安装依赖（首次）
npm install

# 2. 开发模式（热更新，端口 5174）
npm run dev

# 3. 生产构建（tsc 类型检查 + vite 打包到 dist/）
npm run build

# 4. 预览构建产物
npm run preview
```

默认管理员：`admin / admin123`（首次登录强制改密）。

> 演示内容：后端提供 `python -m app.seed_demo`（api/ 目录）可填充轮播/产品/新闻/案例/招聘/关于/留言演示数据，后台各模块即可直接演示。

## 阶段进度

| 阶段 | 状态 |
| --- | --- |
| M3 后台 11 模块界面 | ✅ 完成 |
| M5 三端联调交付 | ✅ 完成（与 api/、frontend/ 联调通过，详见根目录 `README.md` 与 `暖禾-系统测试报告.md` §8） |

## 与后端契约

- 所有响应遵循 `{code,data,msg}`；`code!==0` 时拦截器统一 Toast 并 reject。
- 分页接口返回 `{list,total,page,page_size}`。
- 逻辑删除（`is_activate=0`）、状态双字段（`status`/`publish_status`）等语义与 `数据库设计文档 v1.1` 一致。
- 富文本在「后端」经 bleach 白名单清洗，前端编辑器仅负责录入。
- 静态资源（上传图片）：开发期由 Vite 代理 `/static` → 8000；生产期由后端 `StaticFiles` 提供。

## 实现要点 / 注意事项

- **构建脚本**：使用 `tsc --noEmit && vite build`（未采用 `tsc -b` 工程引用模式，避免 TS6310 在复合工程下禁用 emit 的报错；vite.config.ts 由 Vite 自身处理）。
- **antd 静态 message**：`request.ts` 中错误提示使用 antd 静态 `message`，仅在控制台产生一条兼容告警，不影响功能；页面内交互改用 `App.useApp()` 上下文（已在 `<AntApp>` 内）。
- **权限前端约束**：侧栏菜单与路由守卫按权限动态过滤，仅作展示/体验优化；**后端 RBAC（`require_perm`）为权威鉴权**。
- **bundle 体积**：当前单包约 1.6MB（gzip 513KB），含 antd 全量；如需优化可后续按路由 `import()` 拆包（非阻塞）。
