// 前台公开 API 封装
// 功能：把各业务模块的公开读/写接口集中封装，页面统一调用，避免请求逻辑散落。
// 数据来源：后端 api/ 的公开路由（引 暖禾-项目开发实施方案 4.6）。所有返回已通过 request 层解包为 data。

import { get, post } from './request'
import type {
  Banner,
  SiteSetting,
  AboutContent,
  ProductCategory,
  Product,
  News,
  CaseItem,
  Recruitment,
  Paged,
  MessageCreated
} from '../types'

// 站点设置：模块级缓存，避免 Footer / Contact 等每个页面重复请求同一份数据
let _siteSettingsCache: SiteSetting | null | undefined = undefined

/** 前台轮播图（启用中，sort 升序） */
export function getBanners(): Promise<Banner[]> {
  return get<Banner[]>('/api/banners')
}

/** 站点设置单条（force=true 可绕过缓存强制刷新） */
export function getSiteSettings(force = false): Promise<SiteSetting | null> {
  if (!force && _siteSettingsCache !== undefined) return Promise.resolve(_siteSettingsCache)
  return get<SiteSetting | null>('/api/site-settings').then((data) => {
    _siteSettingsCache = data
    return data
  })
}

/** 关于我们板块（可按 section 过滤；section 取 about_暖禾/history/brand） */
export function getAboutContents(section?: string): Promise<AboutContent[]> {
  return get<AboutContent[]>('/api/about-contents', section ? { section } : undefined)
}

/** 产品分类树（启用中，含 children 嵌套） */
export function getProductCategories(): Promise<ProductCategory[]> {
  return get<ProductCategory[]>('/api/product-categories')
}

/** 前台产品列表（上架，分页） */
export function getProducts(params?: {
  category_id?: number | null
  keyword?: string
  page?: number
  page_size?: number
}): Promise<Paged<Product>> {
  return get<Paged<Product>>('/api/products', params)
}

/** 产品详情（后端校验上架状态） */
export function getProduct(id: number): Promise<Product> {
  return get<Product>(`/api/products/${id}`)
}

/** 前台新闻列表（已发布，分页） */
export function getNews(params?: {
  category?: string
  page?: number
  page_size?: number
}): Promise<Paged<News>> {
  return get<Paged<News>>('/api/news', params)
}

/** 新闻详情（点击后后端阅读量自动 +1） */
export function getNewsDetail(id: number): Promise<News> {
  return get<News>(`/api/news/${id}`)
}

/** 前台案例列表（启用，分页） */
export function getCases(params?: {
  category?: string
  page?: number
  page_size?: number
}): Promise<Paged<CaseItem>> {
  return get<Paged<CaseItem>>('/api/cases', params)
}

/** 案例详情 */
export function getCase(id: number): Promise<CaseItem> {
  return get<CaseItem>(`/api/cases/${id}`)
}

/** 前台招聘列表（招聘中，分页） */
export function getRecruitments(params?: {
  type?: number
  page?: number
  page_size?: number
}): Promise<Paged<Recruitment>> {
  return get<Paged<Recruitment>>('/api/recruitments', params)
}

/** 招聘职位详情 */
export function getRecruitment(id: number): Promise<Recruitment> {
  return get<Recruitment>(`/api/recruitments/${id}`)
}

/** 提交留言 / 预约 / 咨询 / 简历投递（公开，带 60s 限流） */
export function postMessage(body: {
  name: string
  phone?: string
  email?: string
  type: string
  content?: string
}): Promise<MessageCreated> {
  return post<MessageCreated>('/api/messages', body)
}
