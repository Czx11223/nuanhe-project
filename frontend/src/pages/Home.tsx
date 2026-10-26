// 首页
// 功能：聚合展示轮播图、品牌概览、四大核心优势、精选产品、最新动态、招聘/品牌入口。
// 数据来源：真实后端 API（getBanners / getProducts / getNews / getRecruitments / getSiteSettings）；
// 品牌骨架常量（craftHighlights / brandStats）来自 lib/constants.ts（非数据库内容）。
// 图片：统一使用 ImgPlaceholder(imageUrl)，无图时回退品牌实色占位；UIUX 约束不使用渐变/阴影。

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBanners, getNews, getProducts, getRecruitments, getSiteSettings } from '../lib/api'
import { craftHighlights, brandStats } from '../lib/constants'
import ImgPlaceholder from '../components/ImgPlaceholder'
import type { Banner, Product, News, Recruitment, SiteSetting } from '../types'

export default function Home() {
  // 各数据块独立状态：任一组接口失败不影响其余模块展示
  const [banners, setBanners] = useState<Banner[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [news, setNews] = useState<News[]>([])
  const [recruitments, setRecruitments] = useState<Recruitment[]>([])
  const [site, setSite] = useState<SiteSetting | null>(null)

  useEffect(() => {
    // 并行拉取首页所需数据；失败均静默兜底为空/默认值
    getBanners().then(setBanners).catch(() => setBanners([]))
    getProducts({ page_size: 100 }).then((d) => setProducts(d.list)).catch(() => setProducts([]))
    getNews({ page_size: 3 }).then((d) => setNews(d.list)).catch(() => setNews([]))
    getRecruitments({ page_size: 100 }).then((d) => setRecruitments(d.list)).catch(() => setRecruitments([]))
    getSiteSettings().then(setSite).catch(() => setSite(null))
  }, [])

  // 仅展示启用中的轮播，并按 sort 升序
  const activeBanners = banners.filter((b) => b.status === 1).sort((a, b) => a.sort - b.sort)
  const [idx, setIdx] = useState(0)

  // 自动轮播：4 秒切换一张；无轮播图时不启动定时器（避免除零）
  useEffect(() => {
    if (activeBanners.length === 0) return
    const t = setInterval(() => setIdx((i) => (i + 1) % activeBanners.length), 4000)
    return () => clearInterval(t)
  }, [activeBanners.length])

  // 精选产品：后端公开列表无 is_recommended 查询参数，客户端过滤已加载的上架产品并取前 4
  const recommended = products.filter((p) => p.is_recommended === 1 && p.status === 1).slice(0, 4)

  return (
    <div>
      {/* Hero 轮播：图片用 ImgPlaceholder 渲染，链接支持内部路由与外部 http(s) */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
        {activeBanners.length > 0 && (
          <div className="relative h-64 md:h-96 rounded-lg overflow-hidden">
            {activeBanners.map((b, i) => {
              const isExternal = !!b.link_url && /^https?:\/\//i.test(b.link_url)
              const body = (
                <>
                  {/* 图片铺满 + 半透明遮罩提升文字对比度 */}
                  <ImgPlaceholder imageUrl={b.image_url} label={b.title || ''} className="h-full" rounded="rounded-none" />
                  <div className="absolute inset-0 bg-black/25" />
                  <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 text-white">
                    <h1 className="text-3xl md:text-5xl font-bold mb-3">{b.title}</h1>
                    <p className="text-white/80">点击了解更多 →</p>
                  </div>
                </>
              )
              return (
                <div
                  key={b.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    i === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {isExternal ? (
                    <a href={b.link_url || '#'} target="_blank" rel="noreferrer" className="block h-full">{body}</a>
                  ) : (
                    <Link to={b.link_url || '/'} className="block h-full">{body}</Link>
                  )}
                </div>
              )
            })}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {activeBanners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-2.5 h-2.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`}
                  aria-label={`第 ${i + 1} 张`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 品牌概览：静态品牌数据来自 constants.ts */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">匠心家居 · 悦享生活</h2>
          <p className="text-gray-500 mt-2">{site?.site_name || '暖禾家具'} 集研发、制造、销售于一体的现代化家居企业</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {brandStats.map((s) => (
            <div key={s.label} className="card p-6 text-center">
              <div className="text-3xl font-bold text-brand">{s.value}</div>
              <div className="text-gray-500 mt-1 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 工艺亮点：品牌骨架常量 */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <h2 className="text-xl font-bold mb-6">四大核心优势</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {craftHighlights.map((c) => (
            <div key={c.title} className="card p-6">
              <div className="text-3xl mb-3">{c.icon}</div>
              <h3 className="font-semibold mb-1">{c.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 推荐产品：客户端过滤 is_recommended */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">精选产品</h2>
          <Link to="/products" className="text-brand text-sm hover:underline">查看全部 →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {recommended.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="card overflow-hidden hover:border-brand transition">
              <ImgPlaceholder imageUrl={p.cover_image} label={p.name} className="h-40" rounded="rounded-none" />
              <div className="p-4">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-gray-400 text-xs mt-1">{p.series}</div>
                <div className="text-brand font-semibold mt-2">
                  {p.reference_price != null ? `¥${p.reference_price}` : '价格面议'}
                </div>
              </div>
            </Link>
          ))}
          {recommended.length === 0 && <p className="col-span-full text-center text-gray-400 py-12">暂无精选产品</p>}
        </div>
      </section>

      {/* 新闻预览：后端已按发布时间倒序返回前 3 条 */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">最新动态</h2>
          <Link to="/news" className="text-brand text-sm hover:underline">更多新闻 →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {news.map((n) => (
            <Link key={n.id} to={`/news/${n.id}`} className="card overflow-hidden hover:border-brand transition">
              <ImgPlaceholder imageUrl={n.cover_image} label={n.title} className="h-36" rounded="rounded-none" />
              <div className="p-4">
                <span className="tag">{n.category}</span>
                <h3 className="font-medium mt-2 line-clamp-2">{n.title}</h3>
                <p className="text-gray-400 text-xs mt-2">{n.published_at} · {n.views} 阅读</p>
              </div>
            </Link>
          ))}
          {news.length === 0 && <p className="col-span-full text-center text-gray-400 py-12">暂无最新动态</p>}
        </div>
      </section>

      {/* 招聘 / 关于入口：品牌实色卡片（UIUX 禁渐变，用纯色 + hover 透明度变化） */}
      <section className="max-w-6xl mx-auto px-4 mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/recruitment" className="card p-8 flex items-center justify-between bg-brand text-white transition hover:opacity-90">
          <div>
            <h3 className="text-xl font-bold">加入暖禾</h3>
            <p className="text-white/80 text-sm mt-1">查看 {recruitments.length} 个在招职位</p>
          </div>
          <span className="text-white text-2xl">→</span>
        </Link>
        <Link to="/about/brand" className="card p-8 flex items-center justify-between bg-brand-dark text-white transition hover:opacity-90">
          <div>
            <h3 className="text-xl font-bold">了解品牌</h3>
            <p className="text-white/80 text-sm mt-1">匠心 · 原创 · 智能 · 贴心</p>
          </div>
          <span className="text-white text-2xl">→</span>
        </Link>
      </section>
    </div>
  )
}
