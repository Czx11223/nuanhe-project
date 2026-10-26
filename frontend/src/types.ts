// 前端实体类型定义（严格对齐数据库设计文档 v1.1 字段 + 后端 schemas.py 的 Out 模型）
// 说明：
//  - 图片以 image_url / cover_image 返回（字符串或 null）；前端无图时回退蓝调渐变占位。
//  - recruitment.type 为整数（1 社会 / 2 校园），后端额外返回 type_label 中文，前端直接渲染。
//  - 列表接口（products/news/cases/recruitments）返回 Paged<T> 分页包装；其余返回数组/对象。

/** 轮播图（前台只展示 status=1 的启用项） */
export interface Banner {
  id: number
  title: string | null
  image_url: string | null
  link_url: string | null
  sort: number
  status: number
  is_activate: number
}

/** 站点设置（全站唯一记录 id=1） */
export interface SiteSetting {
  id: number
  site_name: string | null
  logo_url: string | null
  icp: string | null
  address: string | null
  phone: string | null
  email: string | null
  business_hours: string | null
  latitude: number | null
  longitude: number | null
  seo_title: string | null
  seo_keywords: string | null
  seo_description: string | null
}

/** 关于我们板块 section 取值 */
export type AboutSection = 'about_暖禾' | 'history' | 'brand'

/** 关于我们内容（富文本 content 经后端 bleach 清洗） */
export interface AboutContent {
  id: number
  section: string
  title: string | null
  content: string | null
  image_url: string | null
  sort: number
  status: number
}

/** 产品分类（一级含 children 嵌套） */
export interface ProductCategory {
  id: number
  name: string
  parent_id: number | null
  sort: number
  status: number
  children: ProductCategory[]
}

/** 产品（cover_image 为封面，gallery 为多图数组） */
export interface Product {
  id: number
  category_id: number | null
  name: string
  series: string | null
  code: string | null
  reference_price: number | null
  cover_image: string | null
  gallery: string[]
  description: string | null
  specs: string | null
  is_recommended: number // 1 推荐
  status: number // 1 上架 / 0 下架
  category_name: string | null // 后端联表补充分类名
}

/** 新闻分类（中文，便于后端直接存储） */
export type NewsCategory = string

/** 新闻（publish_status 1 已发布 / 0 草稿） */
export interface News {
  id: number
  title: string
  category: string
  cover_image: string | null
  summary: string | null
  content: string | null
  author: string | null
  publish_status: number
  published_at: string | null
  views: number
}

/** 案例分类 */
export type CaseCategory = string | null

/** 案例展示 */
export interface CaseItem {
  id: number
  title: string
  category: string | null
  cover_image: string | null
  summary: string | null
  content: string | null
  sort: number
  status: number // 1 启用 / 0 停用
}

/** 招聘类型（整数，后端已映射 type_label 中文） */
export type RecruitType = 1 | 2

/** 招聘职位 */
export interface Recruitment {
  id: number
  type: RecruitType
  type_label: string // 社会招聘 / 校园招聘
  title: string
  department: string | null
  location: string | null
  description: string | null
  requirements: string | null
  status: number // 1 招聘中 / 0 停用
}

/** 分页响应包装（列表接口统一返回） */
export interface Paged<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

/** 留言提交成功返回 */
export interface MessageCreated {
  id: number
}
