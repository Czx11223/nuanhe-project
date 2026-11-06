"""数据库初始化模块（启动钩子调用）
功能：检测数据库是否已建表；若未建表，则执行 init.sql（权威 DDL）建表并写入 schema_version，
      随后调用 seed 填充种子数据。已建表则直接跳过，保证可重复启动。

策略依据：数据库设计文档 第 7 章（init.sql + schema_version，不引入 Alembic）。
"""
import os

from sqlalchemy import inspect, text

from app.db import engine
from app.seed import seed

# EdgeOne 部署：构建器只打包 .py，DDL 内嵌在 app/seed_bundle.py
from app.seed_bundle import INIT_SQL as _INIT_SQL


def init_and_seed() -> None:
    """初始化数据库：建表 + 种子。"""
    inspector = inspect(engine)
    # 若 role 表已存在，说明数据库已初始化，跳过
    if "role" in inspector.get_table_names():
        return

    # 用原生连接逐条执行 init.sql（SQLite 不支持一次 execute 多语句）
    with engine.begin() as conn:
        sql_text = _INIT_SQL
        for stmt in sql_text.split(";"):
            stmt = stmt.strip()
            if stmt:                       # 跳过空语句（如文件末尾多余的 ;）
                conn.execute(text(stmt))

    # 建表后填充种子数据
    seed()
