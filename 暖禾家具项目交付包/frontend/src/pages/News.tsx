// 新闻列表
// 功能：按分类 Tab（全部/企业新闻/行业资讯）筛选已发布新闻。
// 数据来源：getNews() 分页接口；分类参数直接传给后端过滤（category 可选），
// URL 查询参数（?cat=）驱动 Tab 状态，便于导航直达与分享。

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getNews } from '../lib/api'
import ImgPlaceholder from '../components/ImgPlaceholder'
import type { News, NewsCategory } from '../types'

const TABS: (NewsCategory | '全部')[] = ['全部', '企业新闻', '行业资讯']

export default function News() {
  const [params, setParams] = useSearchParams()
  const catParam = (params.get('cat') as NewsCategory) || '全部'
  // Tab 切换：写入 URL 查询参数（同步浏览器地址，可分享/直达）
  const setCat = (c: NewsCategory | '全部') => {
    if (c === '全部') setParams({})
    else setParams({ cat: c })
  }

  const [list, setList] = useState<News[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // 分类为「全部」时不传 category，后端返回全部已发布新闻
    getNews({ category: catParam === '全部' ? undefined : catParam, page_size: 100 })
      .then((d) => {
        if (!cancelled) setList(d.list)
      })
      .catch(() => {
        if (!cancelled) setList([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [catParam])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">新闻资讯</h1>
      <p className="text-gray-500 mt-1">企业动态与行业前沿</p>

      <div className="flex gap-2 mt-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setCat(t)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              catParam === t ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-700 hover:border-brand'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {list.map((n) => (
          <Link key={n.id} to={`/news/${n.id}`} className="card overflow-hidden hover:border-brand transition">
            <ImgPlaceholder imageUrl={n.cover_image} label={n.title} className="h-40" rounded="rounded-none" />
            <div className="p-4">
              <span className="tag">{n.category}</span>
              <h3 className="font-medium mt-2 line-clamp-2">{n.title}</h3>
              <p className="text-gray-400 text-xs mt-2">{n.published_at} · {n.author} · {n.views} 阅读</p>
            </div>
          </Link>
        ))}
        {!loading && list.length === 0 && <p className="col-span-full text-center text-gray-400 py-12">暂无相关新闻</p>}
        {loading && <p className="col-span-full text-center text-gray-400 py-12">加载中…</p>}
      </div>
    </div>
  )
}
