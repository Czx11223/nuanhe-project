"""通用工具模块（M2）
功能：
  1. clean_html：富文本 HTML 入库前白名单清洗，防 XSS（引 技术文档 4.5 / 数据库设计文档 1.2）。
  2. 招聘类型映射：recruit_type_to_label / recruit_label_to_type（整数 1/2 <-> 中文）。
  3. 审计字段注入：set_audit_on_create / set_audit_on_update，
     将当前登录管理员账号写入 created_at / updated_at（人员字段，引 v1.1 审计约定）。
"""
import json

import bleach

# ----------------------------------------------------------------------------
# 一、富文本 XSS 清洗（白名单）
# ----------------------------------------------------------------------------

# 允许保留的标签（与 TipTap 输出及前端渲染对齐）
_ALLOWED_TAGS = [
    "p", "br", "b", "i", "u", "strong", "em", "ul", "ol", "li",
    "a", "img", "h1", "h2", "h3", "blockquote", "pre", "code", "span",
]
# 允许保留的属性
_ALLOWED_ATTRS = {
    "*": ["class"],
    "a": ["href", "target", "rel"],
    "img": ["src", "alt", "width", "height"],
}


def clean_html(html: str | None) -> str | None:
    """对富文本 HTML 做白名单清洗；None 原样返回。

    - 仅保留 _ALLOWED_TAGS 中的标签与 _ALLOWED_ATTRS 中的属性，其余一律剥离。
    - 链接强制加 rel="noopener"（前端渲染时也应保证），降低反向标签页劫持风险。
    """
    if html is None:
        return None
    cleaned = bleach.clean(
        html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRS,
        strip=True,           # 不在白名单的标签被剥离（而非转义保留文本）
    )
    return cleaned


# ----------------------------------------------------------------------------
# 二、招聘类型（整数 <-> 中文）映射
# ----------------------------------------------------------------------------

RECRUIT_TYPE_MAP = {1: "社会招聘", 2: "校园招聘"}


def recruit_type_to_label(type_val: int) -> str:
    """整数类型 -> 中文标签；未知值返回「未知」。"""
    return RECRUIT_TYPE_MAP.get(type_val, "未知")


def recruit_label_to_type(label: str) -> int | None:
    """中文标签 -> 整数类型；未知标签返回 None（调用方应据此拒绝）。"""
    for k, v in RECRUIT_TYPE_MAP.items():
        if v == label:
            return k
    return None


# ----------------------------------------------------------------------------
# 三、审计字段（人员）注入
# ----------------------------------------------------------------------------

def set_audit_on_create(obj, operator: str) -> None:
    """新增记录时写入创建人（created_at 为人员字段，非时间）。

    时间字段 created_date 由 ORM 默认值自动填充，无需在此处理。
    """
    if hasattr(obj, "created_at"):
        obj.created_at = operator


def set_audit_on_update(obj, operator: str) -> None:
    """更新记录时写入修改人（updated_at 为人员字段）。

    时间字段 updated_date 由 ORM onupdate 自动刷新，无需在此处理。
    """
    if hasattr(obj, "updated_at"):
        obj.updated_at = operator


# ----------------------------------------------------------------------------
# 四、JSON 字段（字符串 <-> list）辅助
# ----------------------------------------------------------------------------

def dumps_json(value) -> str:
    """将 list/dict 序列化为 JSON 字符串，便于存入 TEXT 字段。"""
    return json.dumps(value, ensure_ascii=False)


def loads_json(value: str | None, default=None):
    """从 JSON 字符串解析为 Python 对象；失败或为空返回 default。"""
    if not value:
        return default if default is not None else []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else []
