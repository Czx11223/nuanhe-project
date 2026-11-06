# 测试说明

> 结论口径以**可复现脚本**为准。归档的 `archive/系统测试报告_v1.0.md` 是早期人工抽查记录，
> 其中「48/48、38/38 自动化通过」没有对应脚本，不作为验收依据。

## 运行

```bash
pip install -r api/requirements.txt
pip install -r requirements-dev.txt
python tests/smoke.py
```

退出码 0 表示全部通过；任一失败会打印失败项并返回 1。脚本使用临时 SQLite 数据库与临时上传目录，
**不会读写 `api/app.db` 或任何真实数据**。本地需先按 `api/.env.example` 配好 `JWT_SECRET`。

## `tests/smoke.py` 覆盖范围

| 链路 | 用例 |
| --- | --- |
| 健康检查与响应头 | `/api/health`、`/`、公开列表；`nosniff`、`X-Frame-Options` |
| 登录与首次改密 | 错误口令 401；首次登录标记；`/auth/me` 放行；后台列表与 upload 均 403；改密后放行 |
| 匿名留言 | XSS 载荷剥净标签；同 IP 60s 限流 429；换手机号不能绕过限流 |
| 上传 | 伪造 Content-Type 的 HTML 被 400；非图片被 400；真实 PNG 魔数上传成功；扩展名由内容推导 |
| 静态目录 | 上传文件可访问且带 `nosniff`；父目录中的 `app.db` 不可通过 `/static` 访问 |
| 数据层 | `PRAGMA foreign_keys=ON`；外键拦截悬空 `role_id`；`IntegrityError` 映射 409；7 个索引随 `create_all` 建立 |
| 配置 | `JWT_SECRET` 缺失或为示例值时启动直接失败；`ADMIN_INIT_PASSWORD` 生效 |
| 部署副本 | 云函数冷启动从内嵌 `init.sql` 建库；剥离 `/api` 后的路由可访问；上传返回 `/api/static/uploads/...` |

## 前端与构建验证

前端没有自动化测试脚本，发布前至少执行以下命令（两端 `npm run build` 中后台已含 `tsc --noEmit`）：

```bash
cd frontend && npx tsc --noEmit && npm run build
cd ../backend && npx tsc --noEmit && npm run build
cd .. && python edgeone-app/build.py --frontends
node edgeone-app/build.mjs
```

`build.py --frontends` 会整体重建 `dist/`。可复跑一次并比对 `find edgeone-app/dist -type f | sort`
的输出，清单应完全一致（已验证 88 → 88 个文件），以此确认没有历史 hash 包残留。

## 最近一次全量验证结论

| 项目 | 结果 |
| --- | --- |
| 后端 / 云函数 / 测试脚本 Python 语法 | 55 个项目自有 `.py` 文件全部通过（不含 `.edgeone/` 缓存） |
| `frontend` / `backend` `tsc --noEmit` | 均通过 |
| `vite build` 两端 | 均通过；后台拆出 20 个 chunk，官网 13 个 |
| `build.py --frontends` / `build.mjs` | 通过；二次构建产物清单一致 |
| `tests/smoke.py` | local 29 通过 / 0 失败；cloud 12 通过 / 0 失败 |

## CI 建议

当前没有 CI 配置。若接入，建议在每次 push 时串行执行「前端与构建验证」+ 冒烟测试：

```bash
python tests/smoke.py
```

## 尚未覆盖

- 浏览器级 UI 交互（筛选/分页/表单提交）仍需人工或 Playwright 补测。
- 并发写、多实例一致性、真实持久化存储不在当前演示方案范围内。
- 性能与 Lighthouse 指标没有可复现脚本，归档报告中的数值不作为结论。
