// 新闻详情
// 功能：展示已发布新闻正文；访问详情时后端自动将阅读量 +1。
// 数据来源：getNewsDetail(id)（后端校验 publish_status=1，不存在/草稿时 404）。
// 富文本：content 为后端 bleach 白名单清洗后的 HTML，使用 dangerouslySetInnerHTML 渲染。

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getNewsDetail } from '../lib/api'
import type { News } from '../types'

export default function NewsDetail() {
  const { id } = useParams()
  const [item, setItem] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const pid = Number(id)
    if (!pid) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    // 详情接口会自增 views，返回的是最新计数
    getNewsDetail(pid)
      .then((d) => {
        if (!cancelled) setItem(d)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400">加载中…</div>
  }

  if (notFound || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-3">新闻不存在或未发布</h1>
        <Link to="/news" className="btn-primary">返回新闻列表</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-sm text-gray-400 mb-4">
        <Link to="/news" className="hover:text-brand">新闻资讯</Link> / {item.category}
      </div>
      <span className="tag">{item.category}</span>
      <h1 className="text-2xl font-bold mt-2">{item.title}</h1>
      <div className="text-gray-400 text-sm mt-2">{item.published_at} · {item.author} · {item.views} 阅读</div>
      <p className="text-gray-500 mt-4">{item.summary}</p>
      {/* 富文本正文：后端已做 XSS 清洗（bleach 白名单），此处直接渲染 */}
      <div className="rich-text mt-4" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
    </div>
  )
}
