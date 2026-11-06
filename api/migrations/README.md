# 数据库迁移脚本目录（migrations/）

> **当前状态**：目录约定存在，但**运行时并未实现增量迁移执行器**。请勿把脚本放进这里就认为会自动执行。

## 实际行为（见 `api/app/init_db.py`）

- 启动时只检查 `role` 表是否存在；不存在则逐条执行 `api/init.sql` 建表、写入 `schema_version=1`，再调用 `app.seed.seed()` 填充种子。
- 已建库则直接返回，**不会**比对 `schema_version`，也**不会**执行本目录下的 `0002_*.sql`。
- `api/app/models.py` 已声明与 `init.sql` 相同的 7 个索引，因此 `Base.metadata.create_all` 与 `init.sql` 结果一致。

## 若要启用增量迁移

1. 在 `init_and_seed()` 中实现：读取 `schema_version` → 按版本号排序收集未应用的 `NNNN_*.sql` → 逐条事务执行 → 回写版本号。
2. 每个脚本必须可重复检测（或由版本表保证不重复执行），并在 `docs/testing.md` 的回归用例中覆盖。
3. 实现完成后再更新 `docs/database.md` 第 7 章与本文档。

> 当前推荐做法：表结构变更直接重建演示库（数据本就不持久化，见 `docs/deployment.md`）。
