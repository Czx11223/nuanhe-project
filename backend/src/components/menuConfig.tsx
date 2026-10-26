// 后台侧边栏菜单配置（与 UIUX 第 4 章、后台原型一一对应）
// 每个菜单项绑定“所需权限键”，AppLayout 会按当前角色权限动态过滤可见项（前端约束，后端为权威）。
import type { ReactNode } from 'react';
import {
  DashboardOutlined,
  PictureOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  ShoppingOutlined,
  NotificationOutlined,
  SolutionOutlined,
  MessageOutlined,
  SettingOutlined,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { PERMS } from '../lib/perm';

export interface MenuGroup {
  label: string;
  items: { key: string; label: string; icon: ReactNode; perm?: string }[];
}

// 菜单分组与路径（key 即路由 path）
export const menuGroups: MenuGroup[] = [
  {
    label: '概览',
    items: [{ key: '/', label: '工作台', icon: <DashboardOutlined />, perm: undefined }],
  },
  {
    label: '内容管理',
    items: [
      { key: '/banners', label: '轮播图', icon: <PictureOutlined />, perm: PERMS.BANNER },
      { key: '/about-content', label: '关于我们内容', icon: <FileTextOutlined />, perm: PERMS.ABOUT },
      { key: '/product-categories', label: '产品分类', icon: <AppstoreOutlined />, perm: PERMS.PRODUCT_CATEGORY },
      { key: '/products', label: '产品管理', icon: <ShoppingOutlined />, perm: PERMS.PRODUCT },
      { key: '/news', label: '新闻管理', icon: <NotificationOutlined />, perm: PERMS.NEWS },
      { key: '/cases', label: '案例管理', icon: <PictureOutlined />, perm: PERMS.CASE },
      { key: '/recruitments', label: '招聘管理', icon: <SolutionOutlined />, perm: PERMS.RECRUITMENT },
    ],
  },
  {
    label: '互动管理',
    items: [{ key: '/messages', label: '留言反馈', icon: <MessageOutlined />, perm: PERMS.MESSAGE }],
  },
  {
    label: '系统设置',
    items: [
      { key: '/site-settings', label: '站点设置', icon: <SettingOutlined />, perm: PERMS.SITE_SETTING },
      { key: '/admins', label: '管理员管理', icon: <TeamOutlined />, perm: PERMS.ADMIN },
      { key: '/roles', label: '角色管理', icon: <KeyOutlined />, perm: PERMS.ROLE },
    ],
  },
];
