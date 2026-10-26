# 数据库迁移脚本目录（migrations/）

本目录用于存放**后续** schema 升级脚本，命名约定：`0002_描述.sql`、`0003_描述.sql` …。

## 迁移策略（引 数据库设计文档 第 7 章）

- 不引入 Alembic（演示友好、零额外依赖）。
- 初始化由 `init.sql` + `schema_version` 版本表完成。
- 升级时，在 `app/main.py` 的启动钩子中比对 `schema_version`，按版本号顺序执行本目录中
  未应用的迁移，执行后写入对应版本号。
- 开发期可用 `Base.metadata.create_all` 兜底，但**生产以 `init.sql` 为准**。

> 当前 M1 阶段无迁移脚本；后续如需变更表结构（如新增字段），在此追加 `0002_*.sql`。
