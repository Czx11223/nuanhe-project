// 权限键定义与判定工具
// 权限键与 api/ 后端 RBAC（require_perm）严格一致（引实施方案 4.2 / 技术文档附录 A）。

/** 权限键常量 */
export const PERMS = {
  ALL: '*',
  BANNER: 'banner',
  ABOUT: 'about',
  PRODUCT_CATEGORY: 'product_category',
  PRODUCT: 'product',
  NEWS: 'news',
  CASE: 'case',
  RECRUITMENT: 'recruitment',
  MESSAGE: 'message',
  SITE_SETTING: 'site_setting',
  ADMIN: 'admin',
  ROLE: 'role',
} as const;

/** 角色权限编辑页展示的权限项（key + 中文标签） */
export const PERM_OPTIONS: { key: string; label: string }[] = [
  { key: PERMS.BANNER, label: '轮播图' },
  { key: PERMS.ABOUT, label: '关于我们' },
  { key: PERMS.PRODUCT_CATEGORY, label: '产品分类' },
  { key: PERMS.PRODUCT, label: '产品管理' },
  { key: PERMS.NEWS, label: '新闻管理' },
  { key: PERMS.CASE, label: '案例管理' },
  { key: PERMS.RECRUITMENT, label: '招聘管理' },
  { key: PERMS.MESSAGE, label: '留言反馈' },
  { key: PERMS.SITE_SETTING, label: '站点设置' },
  { key: PERMS.ADMIN, label: '管理员管理' },
  { key: PERMS.ROLE, label: '角色管理' },
];

/** 判断当前角色是否拥有某权限：含 '*' 视为拥有全部。 */
export function hasPerm(permissions: string[], key: string): boolean {
  return permissions.includes(PERMS.ALL) || permissions.includes(key);
}
