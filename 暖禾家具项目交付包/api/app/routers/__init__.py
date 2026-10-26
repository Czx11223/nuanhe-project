"""路由包：集中管理所有 APIRouter 实例。

各业务路由文件（auth/banners/...）在此被 import，便于 main.py 统一挂载。
实际挂载逻辑见 app/main.py 的 include_router。
"""
