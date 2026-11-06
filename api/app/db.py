"""数据库引擎与会话模块
功能：创建 SQLAlchemy 引擎、声明所有模型的基类 Base、提供 FastAPI 依赖 get_db。
说明：SQLite 需开启 check_same_thread=False，否则在 FastAPI 多线程（线程池）下会报
      "SQLite objects created in a thread can only be used in that same thread" 错误。
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import SQLALCHEMY_DATABASE_URL

# 创建数据库引擎。echo=False 不打印 SQL；开发排错可临时改为 True。
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},  # 仅 SQLite 需要
    echo=False,
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record):
    """SQLite 默认关闭外键；显式开启约束并启用 WAL，降低并发写锁冲突。"""
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=30000")
    cur.close()

# 会话工厂：每次请求新建一个 Session，请求结束关闭（见 get_db）。
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 所有 ORM 模型的基类；models.py 中的表都继承它。
Base = declarative_base()


def get_db():
    """FastAPI 依赖函数：为每个请求提供一个数据库会话，结束时自动关闭。

    用法：def xxx(db: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
