// 案例详情
// 功能：展示案例标题、分类、封面与正文。
// 数据来源：getCase(id)（后端校验启用状态）。
// 富文本：content 为后端 bleach 白名单清洗后的 HTML，使用 dangerouslySetInnerHTML 渲染（配合 .rich-text 样式）。

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCase } from '../lib/api'
import ImgPlaceholder from '../components/ImgPlaceholder'
import type { CaseItem } from '../types'

export default function CaseDetail() {
  const { id } = useParams()
  const [item, setItem] = useState<CaseItem | null>(null)
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
    getCase(pid)
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
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">加载中…</div>
  }

  if (notFound || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-3">案例不存在</h1>
        <Link to="/cases" className="btn-primary">返回案例列表</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-sm text-gray-400 mb-4">
        <Link to="/cases" className="hover:text-brand">新案例展示</Link> / {item.title}
      </div>
      <h1 className="text-2xl font-bold">{item.title}</h1>
      {item.category && <span className="tag mt-2 inline-block">{item.category}</span>}
      <ImgPlaceholder imageUrl={item.cover_image} label={item.title} className="h-72 mt-4" />
      <p className="text-gray-500 mt-4">{item.summary}</p>
      {/* 富文本正文：后端已做 XSS 清洗（bleach 白名单），此处直接渲染 */}
      <div className="rich-text mt-4" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
    </div>
  )
}
