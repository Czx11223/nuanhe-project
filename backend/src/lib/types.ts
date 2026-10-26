// 后端实体 TypeScript 类型定义
// 严格对应 api/ 的 Pydantic Out 模型字段（引 schemas.py / 数据库设计文档 v1.1）。
// 仅声明前端消费所需的字段；时间戳统一用字符串（ISO）接收。

/** 登录用户信息（随 token 一并返回） */
export interface UserOut {
  id: number;
  username: string;
  real_name?: string | null;
  role_id: number;
  role_code: string;
  permissions: string[]; // 权限键数组，含 '*' 表示全部
  status: number;
}

/** 登录响应：access_token + user + 是否需强制改密 */
export interface LoginResult {
  access_token: string;
  user: UserOut;
  must_change_password: boolean;
}

/** 角色 */
export interface Role {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  permissions: string[]; // 接口层已解析为数组
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 管理员（列表输出） */
export interface AdminUserOut {
  id: number;
  username: string;
  real_name?: string | null;
  role_id: number;
  role_code: string;
  permissions: string[];
  status: number;
  is_activate: number;
  last_login_at?: string | null;
  created_date?: string | null;
}

/** 轮播图 */
export interface Banner {
  id: number;
  title?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  sort: number;
  status: number; // 1 启用 / 0 停用
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 站点设置（单条 id=1） */
export interface SiteSetting {
  id: number;
  site_name?: string | null;
  logo_url?: string | null;
  icp?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  business_hours?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  seo_title?: string | null;
  seo_keywords?: string | null;
  seo_description?: string | null;
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 关于我们板块 */
export interface AboutContent {
  id: number;
  section: string; // about_暖禾 / history / brand
  title?: string | null;
  content?: string | null; // TipTap 富文本 HTML（已后端清洗）
  image_url?: string | null;
  sort: number;
  status: number; // 1 启用 / 0 停用
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 产品分类（树形，含 children） */
export interface ProductCategory {
  id: number;
  name: string;
  parent_id?: number | null;
  sort: number;
  status: number;
  is_activate: number;
  children?: ProductCategory[]; // 子分类嵌套
  created_date?: string | null;
  updated_date?: string | null;
}

/** 产品 */
export interface Product {
  id: number;
  category_id?: number | null;
  name: string;
  series?: string | null;
  code?: string | null;
  reference_price?: number | null;
  cover_image?: string | null;
  gallery: string[]; // 多图列表
  description?: string | null; // 富文本
  specs?: string | null;
  is_recommended: number; // 1 推荐 / 0 否
  sort: number;
  status: number; // 1 上架 / 0 下架
  is_activate: number;
  category_name?: string | null; // 后端联表补充
  created_date?: string | null;
  updated_date?: string | null;
}

/** 新闻（无 status 字段，用 publish_status 表达启停） */
export interface News {
  id: number;
  title: string;
  category: string; // 企业新闻 / 行业资讯
  cover_image?: string | null;
  summary?: string | null;
  content?: string | null;
  author?: string | null;
  sort: number;
  publish_status: number; // 1 已发布 / 0 草稿
  published_at?: string | null;
  views: number;
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 案例 */
export interface CaseItem {
  id: number;
  title: string;
  category?: string | null;
  cover_image?: string | null;
  summary?: string | null;
  content?: string | null;
  sort: number;
  status: number; // 1 启用 / 0 停用
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 招聘（type 为整数 1/2，附带中文 type_label） */
export interface Recruitment {
  id: number;
  type: number; // 1 社会招聘 / 2 校园招聘
  type_label?: string; // 后端计算的中文标签
  title: string;
  department?: string | null;
  location?: string | null;
  description?: string | null;
  requirements?: string | null;
  sort: number;
  status: number; // 1 招聘中 / 0 停用
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 留言反馈 */
export interface Message {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  type: string; // 留言/预约/咨询/简历投递
  content?: string | null;
  status: number; // 0 待处理 / 1 已处理 / 2 已忽略
  reply?: string | null;
  handled_at?: string | null;
  is_activate: number;
  created_date?: string | null;
  updated_date?: string | null;
}

/** 通用分页响应（列表接口返回） */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}
